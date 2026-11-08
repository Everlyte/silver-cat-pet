"""Normalize generated pixels only; never draw or synthesize the character.

Requires Pillow, numpy, scipy. Finds connected pose groups instead of blindly
slicing source art. Uses one shared scale per strip and preserves jump offsets.
"""
import json
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'assets/source'
OUT = ROOT / 'assets/animations'
W, H, BASELINE = 384, 416, 396
SPECS = {
    'idle': ([1500, 350, 110, 800], 0),
    'walk': ([150, 150, 150, 150], 4200),
    'wave': ([260, 180, 240, 260], 1880),
    'annoyed': ([320, 260, 240, 320], 2280),
    'drag': ([220, 200, 220, 200], 2520),
    'sleep': ([1000, 1000, 1000, 1000], 12000),
    'jump': ([180, 150, 190, 240], 760),
}

def clean(image):
    a = np.array(image.convert('RGBA'))
    if (a[:,:,3] == 0).mean() < .05:
        raise ValueError('Source does not have a transparent background')
    # Discard nearly invisible export speckles, preserving opaque white fur.
    a[a[:,:,3] < 40] = 0
    # Remove isolated saturated red matte contamination at exterior edges.
    red = (a[:,:,0] > 190) & (a[:,:,1] < 65) & (a[:,:,2] < 85)
    a[red] = 0
    labels, _ = ndimage.label(a[:,:,3] > 100)
    sizes = np.bincount(labels.ravel()); sizes[0] = 0
    ids = np.flatnonzero(sizes > 3000)
    if len(ids) != 4:
        raise ValueError(f'Expected four separated character groups, found {len(ids)}')
    boxes = []
    keep = np.zeros(labels.shape, dtype=bool)
    for i in ids:
        component = labels == i
        # Retain antialiasing immediately around the substantial silhouette.
        component = ndimage.binary_dilation(component, iterations=2)
        keep |= component
        yy, xx = np.where(component & (a[:,:,3] > 40))
        boxes.append((int(xx.min()),int(yy.min()),int(xx.max())+1,int(yy.max())+1))
    a[~keep] = 0
    a[a[:,:,3] == 0,:3] = 0
    return Image.fromarray(a), sorted(boxes)

def gif_preview(frames, durations, destination):
    # Opaque neutral preview avoids GIF's one-bit-alpha edge artefacts.
    previews = []
    for frame in frames:
        bg = Image.new('RGBA', frame.size, '#e7eee6'); bg.alpha_composite(frame)
        previews.append(bg.convert('RGB').quantize(colors=192))
    previews[0].save(destination, save_all=True, append_images=previews[1:], duration=durations, loop=0, disposal=2)

def main():
    OUT.mkdir(parents=True,exist_ok=True)
    docs = ROOT / 'docs'; docs.mkdir(exist_ok=True)
    manifest = {'version':1,'cellWidth':W,'cellHeight':H,'states':{}}
    report = {'states':{}, 'source':'AI-generated animation strips grounded in approved-cat.png'}
    contact = Image.new('RGB',(W*4,H*len(SPECS)),'#e7eee6')
    all_frames, all_durations = [], []
    for row,(name,(durations,hold)) in enumerate(SPECS.items()):
        source = SOURCE / ('drag-transparent.png' if name == 'drag' else name+'.png')
        im,boxes = clean(Image.open(source))
        maxwidth = max(b[2]-b[0] for b in boxes)
        spanheight = max(b[3] for b in boxes)-min(b[1] for b in boxes)
        # Canonical source strips share the same source resolution. Never fit
        # individual frames independently, which would erase action motion.
        nominal = {'annoyed':.68, 'wave':.59, 'jump':.72}.get(name,.62)
        scale = min(nominal, (W-40)/maxwidth)
        if name != 'jump': scale = min(scale,(H-36)/spanheight)
        source_ground = max(b[3] for b in boxes)
        sheet = Image.new('RGBA',(W*4,H))
        frames=[]; bounds=[]
        for index,box in enumerate(boxes):
            crop=im.crop(box)
            crop=crop.resize((round(crop.width*scale),round(crop.height*scale)),Image.Resampling.LANCZOS)
            x=(W-crop.width)//2
            y=BASELINE-crop.height
            if name=='jump': y-=round((source_ground-box[3])*scale*.55)
            if name=='drag': y=38  # anchor by scruff/head; let the dangling legs move
            frame=Image.new('RGBA',(W,H));frame.alpha_composite(crop,(x,y))
            arr=np.array(frame); arr[arr[:,:,3]<20]=0; frame=Image.fromarray(arr)
            bbox=frame.getbbox()
            assert bbox and bbox[0]>2 and bbox[1]>2 and bbox[2]<W-2 and bbox[3]<H-2,(name,index,bbox)
            frames.append(frame);bounds.append(bbox);sheet.alpha_composite(frame,(index*W,0))
            tile=Image.new('RGBA',(W,H),'#e7eee6');tile.alpha_composite(frame)
            contact.paste(tile.convert('RGB'),(index*W,row*H))
        assert len({f.tobytes() for f in frames})>=3, name+' is static'
        if name=='jump':assert max(b[3] for b in bounds)-min(b[3] for b in bounds)>30,'No jump lift'
        sheet.save(OUT/(name+'.png'),optimize=True)
        gif_preview(frames,durations,docs/(name+'.gif'))
        manifest['states'][name]={'file':name+'.png','frames':4,'durations':durations,'hold':hold}
        report['states'][name]={'frames':4,'scale':scale,'bounds':bounds,'transparent':True,'unclipped':True,'distinctFrames':len({f.tobytes() for f in frames})}
        all_frames+=frames;all_durations+=durations
    contact=contact.resize((960,round(contact.height*960/contact.width)),Image.Resampling.LANCZOS)
    ImageDraw.Draw(contact).text((10,8),'idle / walk / wave / annoyed / drag / sleep / jump',fill='#284c43')
    contact.save(docs/'animation-contact-sheet.jpg',quality=90)
    gif_preview(all_frames,all_durations,docs/'all-actions.gif')
    (OUT/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
    (docs/'asset-validation.json').write_text(json.dumps(report,indent=2)+'\n')
    approved=Image.open(SOURCE/'approved-cat.png').convert('RGBA');approved=approved.crop(approved.getbbox());approved.thumbnail((460,460),Image.Resampling.LANCZOS)
    icon=Image.new('RGBA',(512,512));icon.alpha_composite(approved,((512-approved.width)//2,(512-approved.height)//2));icon.save(ROOT/'assets/icon.png')
    print('Validated 7 states / 28 distinct source poses; sprites, previews and icon saved.')

if __name__=='__main__': main()

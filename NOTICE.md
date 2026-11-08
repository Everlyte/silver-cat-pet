# Sources and attribution

Silver Cat Pet is an independent implementation inspired by the desktop-pet
interaction pattern in [nanonocturne-altago/DeepSeek-Pet](https://github.com/nanonocturne-altago/DeepSeek-Pet),
reviewed at commit `addffb8b60a4953faa94fe1e0b6d28db1c832b75`.
In particular: transparent always-on-top Electron windows, pointer passthrough,
drag reactions, idle/movement/action pools, and a tray/menu recovery path.

The upstream project credits PC2005-cloud / 宇宙之外的浩瀚宇 for its original
dsh-pet engine, ZipZipPipe for its character, 月匠 for its whale widget, and
nanonocturne-altago for integration. This repository does not redistribute
their character animation files, sounds, fonts, balance UI, or API credentials.
Its application modules were independently written for this cat; it is not a
fork or an official DeepSeek product and does not require DeepSeek Harness.

The silver cat concept was selected by the project owner. Concept and animation
images were made with AI image generation using that approved image as a
reference. A real-cat expression reference was supplied during concept design;
the reference video/screenshot is not redistributed. Source strips, normalized
frames, and previews are kept here to make the artwork workflow reproducible.
The MIT license applies to this project's code and included generated assets
to the extent that rights in those assets can be licensed.

Electron APIs were checked against the official documentation:
- https://www.electronjs.org/docs/latest/api/browser-window
- https://www.electronjs.org/docs/latest/tutorial/security

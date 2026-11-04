# Rebuilding the pitch deck

    npm install pptxgenjs@3.12.0
    cp ../Vimba_Demo.mp4 media/demo.mp4      # the recorded demo embedded on slide 12
    node build.js && python3 postprocess.py Vimba_Pitch_Final.pptx

`build.js` draws every slide (Georgia and Arial, the deck's palette and grid) and the speaker
notes; `postprocess.py` rounds the screenshot corners and marks each slide's title.
`artifact/` holds the same deck as Claude slides files; `video/` explains how the demo video
was recorded and narrated.

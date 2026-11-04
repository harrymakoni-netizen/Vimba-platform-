# Demo video

`presentation/Vimba_Demo.mp4` (1:44, 1280x720) was recorded on the live demo at
vimba-platform.vercel.app with Playwright, then narrated.

- `lines.json`: the voice-over, one clip per scene (voice en-ZA-LeahNeural via edge-tts,
  `tts.py`); the reader's voice note uses en-KE-AsiliaNeural.
- `record.js`: resets the demo, plays the journey paced to the clips (captions and a
  visible cursor are injected into the page), records it, and resets the demo again.
  Paths to the logo and the photo of the article point at a scratch folder; adjust them.
- The narration is placed at each scene's start time from `timings.json` and mixed with
  ffmpeg (loudness normalised to -16 LUFS).

## The 36-second cut

`presentation/Vimba_Demo_36s.mp4` (35.8 s, 2.5 MB) fits the pitch's 40-second demo slot and is the
video embedded on slide 12 of the deck. It is cut from the same live recording: `cut_plan.json`
lists each shot (source start and end, playback speed) and when each narration line from
`cut_lines.json` starts. Typing and form filling are sped up; the receipt, the voice note, the
approval and the Superseded passports play at normal speed.

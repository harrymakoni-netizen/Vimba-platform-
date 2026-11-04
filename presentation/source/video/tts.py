"""Text to speech with edge-tts, trusting the session's proxy CA bundle (verification stays on).
Usage: python3 tts.py <voice> <rate e.g. +0%> <out.mp3> <text...>"""
import asyncio, sys
import certifi
certifi.where = lambda: '/root/.ccr/ca-bundle.crt'   # edge-tts reads certifi; point it at the proxy bundle
import edge_tts

async def main(voice, rate, out, text):
    await edge_tts.Communicate(text, voice, rate=rate).save(out)

asyncio.run(main(sys.argv[1], sys.argv[2], sys.argv[3], ' '.join(sys.argv[4:])))

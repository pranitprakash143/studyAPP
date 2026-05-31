---
title: 3. Open-Source Local Models
subject: History
topic: TTS
tags: [open-source models, local models, python, javascript integration, tts, speech synthesis, ai models]
related: [[[Python]], [[JavaScript frontend]], [[Node backend]], [[FastAPI]], [[Flask]], [[HTTP requests]], [[Llama 3.2]], [[Resemble AI]]]
sources: [pasted_text_History_TTS]
last_compiled: 2026-05-31T07:06:27Z
---

## Summary
Python is the dominant language for running open-source models locally. These models can be integrated with JavaScript frontends or Node backends by wrapping Python TTS scripts in APIs like FastAPI or Flask, accessed via HTTP requests. Several top open-source models exist, each with unique features, such as Higgs Audio V2 for expressiveness, Chatterbox for natural speech, Kani TTS for real-time generation, Kokoro for resource-constrained environments, and Suno Bark for non-speech sound generation.

## Key Facts
- Python is the dominant language for running models locally or on private servers.
- To integrate Python TTS scripts with JavaScript frontends or Node backends, they are wrapped in lightweight APIs.
- FastAPI or Flask can be used to build these APIs.
- HTTP requests are used to access these APIs from JavaScript code.
- Higgs Audio V2 is a massive open-source model built on Llama 3.2, known for industry-leading expressiveness, emotional emulation, and voice cloning.
- Chatterbox (by Resemble AI) is a fast, easy-to-use model that produces natural speech and features configurable expressiveness.
- Kani TTS is a modern, two-stage pipeline model optimized for real-time generation and low VRAM usage.
- Kokoro is an ultra-lightweight model (82M parameters) that is fast and suitable for local, resource-constrained environments.
- Kokoro sacrifices a slight bit of naturalness compared to larger multi-billion parameter models.
- Suno Bark is unique for its ability to generate non-speech sounds like laughs, sighs, hesitations, and background noise, making output sound organic.

## Connections
- [[[[Python]]]] — Dominant language for running local models and for TTS scripts.
- [[[[JavaScript frontend]]]] — Can integrate with local models via APIs.
- [[[[Node backend]]]] — Can integrate with local models via APIs.
- [[[[FastAPI]]]] — Used to build lightweight APIs for Python TTS scripts.
- [[[[Flask]]]] — Used to build lightweight APIs for Python TTS scripts.
- [[[[HTTP requests]]]] — Method for JavaScript code to interact with Python APIs.
- [[[[Llama 3.2]]]] — The base model upon which Higgs Audio V2 is built.
- [[[[Resemble AI]]]] — The creator of the Chatterbox model.

## Memory Hooks
_No memory aids available._

## Quick Revision
- Python is the dominant language for running open-source models locally.
- For JavaScript integration, Python TTS scripts are wrapped in APIs (FastAPI/Flask) and accessed via HTTP requests.
- Higgs Audio V2 is a massive model based on Llama 3.2, known for expressiveness and voice cloning.
- Chatterbox (by Resemble AI) offers natural speech with configurable expressiveness.
- Kani TTS is a two-stage model optimized for real-time generation and low VRAM.
- Kokoro is an ultra-lightweight (82M parameters) and fast model for resource-constrained environments, with a slight trade-off in naturalness.
- Suno Bark is unique for generating non-speech sounds like laughs, sighs, and background noise.

## Sources
- pasted_text_History_TTS

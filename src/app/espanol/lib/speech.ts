// ── Speech Utilities (TTS + STT) ──────────────────────────────────────────────

export function speak(text: string, rate: number = 0.84): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window === "undefined" || !window.speechSynthesis) { resolve(); return; }
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "es";
    u.rate = rate;
    const voices = window.speechSynthesis.getVoices();
    const v = voices.find(v => v.lang.startsWith("es-CO")) || voices.find(v => v.lang.startsWith("es"));
    if (v) u.voice = v;
    u.onend = () => resolve();
    u.onerror = () => resolve();
    window.speechSynthesis.speak(u);
  });
}

export function speakSlow(text: string): Promise<void> {
  return speak(text, 0.6);
}

export function speakNormal(text: string): Promise<void> {
  return speak(text, 0.84);
}

export function speakFast(text: string): Promise<void> {
  return speak(text, 1.15);
}

export function stopSpeaking(): void {
  if (typeof window !== "undefined" && window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
}

export async function transcribeAudio(blob: Blob): Promise<string | null> {
  if (blob.size < 100) return null;
  const formData = new FormData();
  formData.append("file", blob, "recording.webm");
  try {
    const res = await fetch("/api/espanol/whisper", { method: "POST", body: formData });
    const data = await res.json();
    return data.text || null;
  } catch {
    return null;
  }
}

export class AudioRecorder {
  private mediaRec: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private stream: MediaStream | null = null;

  async start(): Promise<boolean> {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.mediaRec = new MediaRecorder(this.stream, { mimeType: "audio/webm" });
      this.chunks = [];
      this.mediaRec.ondataavailable = (e) => { if (e.data.size > 0) this.chunks.push(e.data); };
      this.mediaRec.start();
      return true;
    } catch {
      return false;
    }
  }

  stop(): Promise<Blob> {
    return new Promise((resolve) => {
      if (!this.mediaRec) { resolve(new Blob()); return; }
      this.mediaRec.onstop = () => {
        this.stream?.getTracks().forEach(t => t.stop());
        resolve(new Blob(this.chunks, { type: "audio/webm" }));
      };
      this.mediaRec.stop();
    });
  }

  get isRecording(): boolean {
    return this.mediaRec?.state === "recording";
  }
}

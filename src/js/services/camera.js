let stream = null;
let timer = null;
let busy = false;

export const cameraSupported = () => Boolean(window.BarcodeDetector && navigator.mediaDevices?.getUserMedia);

export async function startScan(video, onCode) {
  if (!cameraSupported()) throw new Error('المتصفح لا يدعم قراءة الباركود. اكتب الرقم يدوياً.');
  stopScan(video);
  const detector = new window.BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128'] });
  stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
    audio: false
  });
  video.srcObject = stream;
  video.hidden = false;
  await video.play();

  timer = window.setInterval(async () => {
    if (busy || !stream) return;
    busy = true;
    try {
      const codes = await detector.detect(video);
      if (codes.length && codes[0].rawValue) {
        const value = codes[0].rawValue;
        stopScan(video);
        onCode(value);
      }
    } catch {
      /* فريم بدون نتيجة */
    } finally {
      busy = false;
    }
  }, 420);
}

export function stopScan(video) {
  if (timer) window.clearInterval(timer);
  timer = null;
  busy = false;
  stream?.getTracks().forEach((track) => track.stop());
  stream = null;
  if (video) {
    video.srcObject = null;
    video.hidden = true;
  }
}

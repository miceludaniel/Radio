import React, { useEffect, useRef, useState } from 'react';
import axios from 'axios';

// Cada nivel (0-255) se mapea a un color tipo "waterfall": azul (débil) -> rojo (fuerte).
function levelToColor(level) {
  const t = Math.max(0, Math.min(255, level)) / 255;
  const hue = 240 - t * 240;
  return `hsl(${hue}, 100%, ${20 + t * 30}%)`;
}

function BandScope({ puerto }) {
  const canvasRef = useRef(null);
  const sinceRef = useRef(0);
  const samplesRef = useRef(0);

  const [active, setActive] = useState(false);
  const [spanKhz, setSpanKhz] = useState(null);
  const [stepHz, setStepHz] = useState(null);
  const [lastSeq, setLastSeq] = useState(0);
  const [rowsDrawn, setRowsDrawn] = useState(0);

  const enviar = (dato) => {
    axios.post(puerto, { dato }).catch((error) => {
      console.error('Error al enviar el dato:', error);
    });
  };

  useEffect(() => {
    const intervalId = setInterval(() => {
      axios
        .get(`/bandscope-rows?since=${sinceRef.current}`)
        .then((response) => {
          const { rows, lastSeq: seq, active: activeNow, spanKhz: sk, stepHz: sh, samples } = response.data;
          sinceRef.current = seq;
          setActive(activeNow);
          setSpanKhz(sk);
          setStepHz(sh);
          setLastSeq(seq);

          if (!rows || rows.length === 0) {
            return;
          }
          const canvas = canvasRef.current;
          if (!canvas) {
            return;
          }
          if (canvas.width !== samples) {
            canvas.width = samples;
            samplesRef.current = samples;
          }
          const ctx = canvas.getContext('2d');
          const w = canvas.width;
          const h = canvas.height;

          rows.forEach((row) => {
            ctx.drawImage(canvas, 0, 0, w, h - 1, 0, 1, w, h - 1);
            row.levels.forEach((level, x) => {
              ctx.fillStyle = levelToColor(level);
              ctx.fillRect(x, 0, 1, 1);
            });
          });
          setRowsDrawn((n) => n + rows.length);
        })
        .catch((error) => {
          console.error('Error al pedir bandscope-rows:', error);
        });
    }, 400);

    return () => clearInterval(intervalId);
  }, []);

  return (
    <div style={{ textAlign: 'center', color: 'cyan' }}>
      <div>
        <button className={'button1'} onClick={() => enviar('nullbandscope_on')}>
          Start
        </button>
        <button className={'button1'} onClick={() => enviar('nullbandscope_off')}>
          Stop
        </button>
        <button className={'button1'} onClick={() => enviar('nullbandscope_span_do')}>
          Span -
        </button>
        <button className={'button1'} onClick={() => enviar('nullbandscope_span_up')}>
          Span +
        </button>
      </div>
      <p>
        {active ? 'Activo' : 'Detenido'}
        {spanKhz != null ? ` · ±${spanKhz} kHz · paso ${stepHz / 1000} kHz` : ''}
      </p>
      <p style={{ fontSize: '8pt', color: 'gray' }}>
        seq: {lastSeq} · filas dibujadas: {rowsDrawn}
      </p>
      <canvas
        ref={canvasRef}
        width={20}
        height={200}
        style={{
          width: '90%',
          height: '260pt',
          imageRendering: 'pixelated',
          backgroundColor: '#000',
          border: '1px solid gray',
        }}
      />
    </div>
  );
}

export default BandScope;

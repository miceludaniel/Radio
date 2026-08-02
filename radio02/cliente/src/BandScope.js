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
  const [samples, setSamples] = useState(0);
  const [centerHz, setCenterHz] = useState(null);
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
          const { rows, lastSeq: seq, active: activeNow, spanKhz: sk, stepHz: sh, samples: sampleCount, centerHz: chz } = response.data;
          sinceRef.current = seq;
          setActive(activeNow);
          setSpanKhz(sk);
          setStepHz(sh);
          setSamples(sampleCount);
          setCenterHz(chz);
          setLastSeq(seq);

          if (!rows || rows.length === 0) {
            return;
          }
          const canvas = canvasRef.current;
          if (!canvas) {
            return;
          }
          if (canvas.height !== sampleCount) {
            canvas.height = sampleCount;
            samplesRef.current = sampleCount;
          }
          const ctx = canvas.getContext('2d');
          const w = canvas.width;
          const h = canvas.height;

          rows.forEach((row) => {
            // Frecuencia vertical (más alta abajo, freqIndex creciente) y
            // tiempo horizontal: cada barrido nuevo entra por la izquierda
            // y empuja el historial hacia la derecha.
            ctx.drawImage(canvas, 0, 0, w - 1, h, 1, 0, w - 1, h);
            row.levels.forEach((level, freqIndex) => {
              ctx.fillStyle = levelToColor(level);
              ctx.fillRect(0, freqIndex, 1, 1);
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

  // Frecuencia de cada fila del eje vertical (freqIndex 0 = más baja, arriba).
  const half = samples / 2;
  const freqLabels =
    centerHz != null && samples > 0
      ? Array.from({ length: samples }, (_, i) => ((centerHz + (i - half) * stepHz) / 1e6).toFixed(5))
      : [];

  return (
    <div
      style={{
        textAlign: 'center',
        color: 'cyan',
        flex: 1,
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
      }}
    >
      <div>
        <button className={'button1'} onClick={() => enviar('nullbandscope_on')}>
          Disparar
        </button>
        <button className={'button1'} onClick={() => enviar('nullbandscope_off')}>
          Detener
        </button>
        <button className={'button1'} onClick={() => enviar('nullbandscope_span_do')}>
          Paso -
        </button>
        <button className={'button1'} onClick={() => enviar('nullbandscope_span_up')}>
          Paso +
        </button>
      </div>
      <p>
        {active ? 'Activo' : 'Detenido'}
        {spanKhz != null ? ` · ±${spanKhz} kHz · paso ${stepHz / 1000} kHz` : ''}
      </p>
      <p style={{ fontSize: '8pt', color: 'gray' }}>
        seq: {lastSeq} · filas dibujadas: {rowsDrawn}
      </p>
      <div style={{ display: 'flex', flexDirection: 'row', flex: 1, minHeight: 0, width: '90%' }}>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            width: '38pt',
            fontSize: '6pt',
            fontFamily: 'monospace',
            color: 'gray',
            textAlign: 'right',
            paddingRight: '2px',
          }}
        >
          {freqLabels.map((label, i) => (
            <div key={i}>{label}</div>
          ))}
        </div>
        <canvas
          ref={canvasRef}
          width={200}
          height={20}
          style={{
            flex: 1,
            minHeight: 0,
            imageRendering: 'pixelated',
            backgroundColor: '#000',
            border: '1px solid gray',
          }}
        />
      </div>
    </div>
  );
}

export default BandScope;

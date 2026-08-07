import React, { useEffect, useRef, useState } from 'react';
import axios from 'axios';

// Cada nivel se mapea a un solo tono (amarillo), variando el brillo: nivel 0
// -> amarillo al 0% (negro), nivel 100 y para arriba -> amarillo pleno (así
// las señales reales, casi siempre débiles dentro del rango 0-255, se ven
// en vez de quedar todas cerca del negro).
// Por debajo del umbral de squelch, negro en vez del gradiente.
const LEVEL_FULL_YELLOW = 100;
function levelToColor(level, squelch) {
  if (level < squelch) {
    return '#000';
  }
  const t = Math.max(0, Math.min(LEVEL_FULL_YELLOW, level)) / LEVEL_FULL_YELLOW;
  return `hsl(60, 100%, ${t * 50}%)`;
}

function BandScope({ puerto, onVolver }) {
  const canvasRef = useRef(null);
  const sinceRef = useRef(0);
  const samplesRef = useRef(0);
  const requestSeqRef = useRef(0);

  const [active, setActive] = useState(false);
  const [spanKhz, setSpanKhz] = useState(null);
  const [stepHz, setStepHz] = useState(null);
  const [samples, setSamples] = useState(0);
  const [segments, setSegments] = useState(1);
  const [squelch, setSquelch] = useState(0);
  const [centerHz, setCenterHz] = useState(null);
  const [lastSeq, setLastSeq] = useState(0);
  const [rowsDrawn, setRowsDrawn] = useState(0);

  const refresh = () => {
    // Con polling cada 400ms + un pedido extra al toque de cada botón, dos
    // pedidos pueden quedar en vuelo a la vez; por WiFi/celular no siempre
    // resuelven en orden. Si uno viejo llega después de uno más nuevo,
    // pisaría la pantalla con datos desactualizados — se descarta cualquier
    // respuesta que no sea la del pedido más reciente.
    const reqId = ++requestSeqRef.current;
    axios
      .get(`/bandscope-rows?since=${sinceRef.current}`)
      .then((response) => {
        if (reqId !== requestSeqRef.current) {
          return;
        }
        const { rows, lastSeq: seq, active: activeNow, spanKhz: sk, stepHz: sh, samples: sampleCount, segments: segs, squelch: sq, centerHz: chz } = response.data;
        sinceRef.current = seq;
        setActive(activeNow);
        setSpanKhz(sk);
        setStepHz(sh);
        setSamples(sampleCount);
        setSegments(segs);
        setSquelch(sq);
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
            ctx.fillStyle = levelToColor(level, sq);
            ctx.fillRect(0, freqIndex, 1, 1);
          });
        });
        setRowsDrawn((n) => n + rows.length);
      })
      .catch((error) => {
        console.error('Error al pedir bandscope-rows:', error);
      });
  };

  // Después de cada click se pide el estado al toque, en vez de esperar al
  // próximo tick del polling (hasta 400ms) — si no, el botón parecía no
  // hacer nada hasta el toque siguiente.
  const enviar = (dato) => {
    axios
      .post(puerto, { dato })
      .then(refresh)
      .catch((error) => {
        console.error('Error al enviar el dato:', error);
      });
  };

  useEffect(() => {
    const intervalId = setInterval(refresh, 400);
    return () => clearInterval(intervalId);
  }, []);

  // Al disparar, limpiar el canvas al toque (el servidor también borra su
  // historial de filas) para no mezclar en pantalla datos de un barrido
  // anterior con el que arranca.
  const disparar = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
    }
    setRowsDrawn(0);
    enviar('nullbandscope_on');
  };

  // Frecuencia de cada fila del eje vertical (freqIndex 0 = más baja, arriba).
  // Como máximo 20 etiquetas: con muchos segmentos hay demasiadas muestras
  // para mostrar una por fila sin amontonarse, así que se muestran
  // espaciadas parejo en vez de una por muestra.
  const half = samples / 2;
  const MAX_FREQ_LABELS = 20;
  const labelStep = samples > 0 ? Math.max(1, Math.ceil(samples / MAX_FREQ_LABELS)) : 1;
  const freqLabels =
    centerHz != null && samples > 0
      ? Array.from({ length: Math.ceil(samples / labelStep) }, (_, j) => {
          const i = j * labelStep;
          return ((centerHz + (i - half) * stepHz) / 1e6).toFixed(5);
        })
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
        <button className={'button1'} onClick={onVolver}>
          Controles
        </button>
        <button className={'button1'} onClick={disparar}>
          Disparar
        </button>
        <button className={'button1'} onClick={() => enviar('nullbandscope_off')}>
          Detener
        </button>
        <button className={'button1'} onClick={() => enviar('nullbandscope_step_do')}>
          Salto -
        </button>
        <button className={'button1'} onClick={() => enviar('nullbandscope_step_up')}>
          Salto +
        </button>
        <button className={'button1'} onClick={() => enviar('nullbandscope_width_do')}>
          Ancho -
        </button>
        <button className={'button1'} onClick={() => enviar('nullbandscope_width_up')}>
          Ancho +
        </button>
        <button className={'button1'} onClick={() => enviar('nullbandscope_squelch_do')}>
          Squelch -
        </button>
        <button className={'button1'} onClick={() => enviar('nullbandscope_squelch_up')}>
          Squelch +
        </button>
      </div>
      <p>
        {active ? 'Activo' : 'Detenido'}
        {spanKhz != null ? ` · ±${spanKhz} kHz · paso ${stepHz / 1000} kHz` : ''}
        {segments > 1 ? ` · ${segments} segmentos` : ' · 1 segmento'}
        {` · squelch ${squelch}`}
      </p>
      <p style={{ fontSize: '8pt', color: 'gray' }}>
        seq: {lastSeq} · filas dibujadas: {rowsDrawn}
      </p>
      <div style={{ display: 'flex', flexDirection: 'row', flex: 1, minHeight: 0, width: '90%' }}>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-around',
            alignItems: 'flex-end',
            width: '40pt',
            fontSize: '6pt',
            fontFamily: 'monospace',
            fontWeight: 'bold',
            color: 'gray',
            textAlign: 'right',
            paddingRight: '2px',
          }}
        >
          {freqLabels.map((label, i) => (
            <div key={i} style={{ width: 'fit-content', transform: 'scale(1.5, 2)', transformOrigin: 'right' }}>{label}</div>
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

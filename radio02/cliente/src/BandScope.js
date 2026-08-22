import React, { useEffect, useRef, useState } from 'react';
import axios from 'axios';

// Cada nivel (0-255, el rango real que manda el radio) se mapea al largo de
// la barra de esa frecuencia, proporcional al nivel real dentro de ese rango
// completo (0=sin barra, 255=barra entera) — sin restar el squelch, para no
// estirar la escala. El squelch sólo decide qué filas se dibujan (se
// filtran antes de llamar a esta función), no el largo de la barra.
const LEVEL_MAX = 255;
// intensity multiplica el largo antes de tocar el techo (100% del ancho), a
// modo de ganancia manual: sirve para que señales débiles se vean más largas
// sin tocar el squelch.
function levelToBarWidth(level, intensity, canvasWidth) {
  const t = Math.max(0, Math.min(LEVEL_MAX, level)) / LEVEL_MAX;
  const boosted = Math.min(1, t * intensity);
  return boosted * canvasWidth;
}

// Cada segmento del bandscope junta 32 muestras (16 "de abajo", paquete
// NE170, + 16 "de arriba", paquete NE180 — ver servidor/index.js,
// bandscopeComputeHalves). Comparado contra una señal real, el bloque "de
// abajo" calza bien, pero TODO el bloque "de arriba" aparece corrido un
// paso hacia arriba: la primera muestra de NE180, que la documentación dice
// que está "en la frecuencia central", en la práctica repite la frecuencia
// del final del bloque de abajo en vez de ser una muestra nueva. Se corrige
// restando un paso extra a toda la mitad "de arriba" de cada segmento.
const SAMPLES_PER_SEGMENT = 32;
const SEGMENT_HALF = SAMPLES_PER_SEGMENT / 2;
function rowFrequencyHz(i, centerHz, stepHz, samples) {
  const segIndex = Math.floor(i / SAMPLES_PER_SEGMENT);
  const withinSeg = i % SAMPLES_PER_SEGMENT;
  const totalSegments = samples / SAMPLES_PER_SEGMENT;
  const segWidthHz = SAMPLES_PER_SEGMENT * stepHz;
  const totalWidthHz = totalSegments * segWidthHz;
  const segCenterHz = centerHz - totalWidthHz / 2 + segIndex * segWidthHz + segWidthHz / 2;
  const offsetSteps = withinSeg < SEGMENT_HALF ? withinSeg - SEGMENT_HALF : withinSeg - SEGMENT_HALF - 1;
  return segCenterHz + offsetSteps * stepHz;
}

function BandScope({ puerto, onVolver }) {
  const canvasRef = useRef(null);
  const sinceRef = useRef(0);
  const samplesRef = useRef(0);
  const requestSeqRef = useRef(0);
  // refresh() se registra una sola vez en el setInterval (ver useEffect más
  // abajo) y queda con ese closure para siempre, así que no ve actualizarse
  // el estado de React en llamadas futuras — de ahí el ref, para que el
  // deslizador de intensidad sí se refleje en los próximos barridos.
  const intensityRef = useRef(1);

  const [active, setActive] = useState(false);
  const [spanKhz, setSpanKhz] = useState(null);
  const [stepHz, setStepHz] = useState(null);
  const [samples, setSamples] = useState(0);
  const [segments, setSegments] = useState(1);
  const [squelch, setSquelch] = useState(0);
  const [centerHz, setCenterHz] = useState(null);
  const [lastSeq, setLastSeq] = useState(0);
  const [rowsDrawn, setRowsDrawn] = useState(0);
  const [intensity, setIntensity] = useState(1);

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

        // Cada fila (frecuencia) es una barra que crece de izquierda a
        // derecha según su nivel — no un historial en el tiempo, así que
        // sólo importa la última pasada del lote: se redibuja entera cada
        // vez en vez de acumularse.
        const lastRow = rows[rows.length - 1];
        ctx.clearRect(0, 0, w, h);
        ctx.fillStyle = '#fff';
        lastRow.levels.forEach((level, freqIndex) => {
          if (level < sq) {
            return;
          }
          const barWidth = levelToBarWidth(level, intensityRef.current, w);
          ctx.fillRect(0, freqIndex, barWidth, 1);
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

  intensityRef.current = intensity;

  // Cada fila (muestra de frecuencia) del waterfall se dibuja siempre a la
  // misma altura en píxeles, sin importar cuántas filas haya — con más
  // muestras el gráfico entero es más alto y se scrollea, en vez de achicar
  // las filas para que todas entren en un contenedor de altura fija. Así la
  // posición de cada etiqueta es una cuenta exacta en píxeles (fila * alto),
  // sin porcentajes ni transforms para hacerla calzar.
  const ROW_HEIGHT_PX = 16;
  // Paso entre etiquetas mostradas para que no se amontone el texto: el
  // mínimo de filas necesarias para dejar un renglón de aire entre una
  // etiqueta y la siguiente.
  const MIN_LABEL_SPACING_PX = 14;
  const labelStep = samples > 0 ? Math.max(1, Math.ceil(MIN_LABEL_SPACING_PX / ROW_HEIGHT_PX)) : 1;
  const rowLabels = [];
  if (centerHz != null && samples > 0) {
    for (let i = 0; i < samples; i += labelStep) {
      rowLabels.push({ i, value: (rowFrequencyHz(i, centerHz, stepHz, samples) / 1e6).toFixed(5) });
    }
  }
  const totalHeightPx = samples * ROW_HEIGHT_PX;

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
      <div style={{ width: '90%', display: 'flex', alignItems: 'center', gap: '6px', margin: '2px 0 6px' }}>
        <span style={{ fontSize: '8pt', color: 'gray' }}>Intensidad</span>
        <input
          type="range"
          min={1}
          max={20}
          step={0.1}
          value={intensity}
          onChange={(e) => setIntensity(Number(e.target.value))}
          style={{ flex: 1 }}
        />
        <span style={{ fontSize: '8pt', color: 'gray', width: '28px', textAlign: 'right' }}>{intensity.toFixed(1)}x</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'row', flex: 1, minHeight: 0, width: '90%', overflowY: 'auto' }}>
        <div style={{ position: 'relative', width: '45pt', height: totalHeightPx, flexShrink: 0 }}>
          {rowLabels.map(({ i, value }) => (
            <div
              key={i}
              style={{
                position: 'absolute',
                top: i * ROW_HEIGHT_PX - 8,
                left: '2px',
                transform: 'translateY(-50%)',
                fontSize: '7pt',
                fontFamily: 'monospace',
                fontWeight: 'bold',
                color: 'cyan',
                pointerEvents: 'none',
                whiteSpace: 'nowrap',
              }}
            >
              {value}
            </div>
          ))}
        </div>
        <div style={{ position: 'relative', flex: 1, height: totalHeightPx }}>
          <canvas
            ref={canvasRef}
            width={200}
            height={20}
            style={{
              width: '100%',
              height: '100%',
              imageRendering: 'pixelated',
              backgroundColor: '#000',
            }}
          />
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              pointerEvents: 'none',
              // Una línea de 1px al borde superior de cada fila, repetida
              // cada ROW_HEIGHT_PX: separa visualmente una fila de la
              // siguiente sin tener que dibujar un div por fila.
              backgroundImage: `repeating-linear-gradient(to bottom, red 0px, red 1px, transparent 1px, transparent ${ROW_HEIGHT_PX}px)`,
            }}
          />
        </div>
      </div>
    </div>
  );
}

export default BandScope;

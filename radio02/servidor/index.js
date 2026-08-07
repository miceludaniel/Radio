const express = require('express');
const bodyParser = require('body-parser');
const app = express();
const port = 10000;
const fs = require('fs');
const { SerialPort } = require('serialport');
const USBRelay = require("@josephdadams/usbrelay");
//const relay = new USBRelay('DevSrvsID:4297844027');
const relay = new USBRelay();

const portcom = new SerialPort({
  path: '/dev/tty.usbserial-1430',
  //path: '/dev/tty.auricularesSony',
  baudRate: 9600,
  dataBits: 8,
  parity: 'none',
  stopBits: 1,
  flowControl: false
});

//function valoresPorDefecto() {
  const att = 0;
  const ffrequency = 999;
  const mode = 0;
  const volume = 99;
  const nb = 0;
  const wide = 0;
  const Squelch = 0;
  const IfShift = 128;
  const tuningStep = 10;

//********************* Band Scope *
// Cada comando de bandscope (ME00001...) pide como máximo 16 muestras por
// lado (el protocolo sólo documenta con claridad un paquete serie por
// lado, NE170/NE180). "Salto -/+" elige el paso (Hz entre muestras) y
// "Ancho -/+" elige cuántos de esos comandos de 16 muestras se encadenan,
// contiguos, para cubrir un ancho mayor (barrido panorámico, más abajo).
const rutaBandscopeOn = '/Users/danielMac/ws/workspace/radio02/config/bandscopeOn.json';

// "Ancho -/+" ya no es un ancho en KHz elegido a mano: es la cantidad de
// segmentos (comandos ME00001 de 16 muestras por lado cada uno) que se
// encadenan, contiguos, cada uno arrancando exactamente donde terminó el
// anterior (frecuencia final + paso). El ancho logrado = segmentos × 32 ×
// paso, así que depende directamente de "Salto"; y como "Ancho +" suma un
// segmento entero por click, los valores disponibles van creciendo según
// el ancho que da cada comando de bandscope con el paso actual.
const BANDSCOPE_MAX_SEGMENTS = 16;
// Demora tras resintonizar antes de pedir el barrido del segmento. Valor de
// arranque razonable, sin confirmar contra el equipo real (no hay dato de
// tiempo de PLL-lock en la documentación del protocolo); puede necesitar
// ajuste.
const BANDSCOPE_SEGMENT_SETTLE_MS = 300;
const rutaBandscopeWidth = '/Users/danielMac/ws/workspace/radio02/config/bandscopeWidth.json';

// "Squelch -/+" del bandscope: umbral (0-255, de a uno) para el color del
// waterfall — las muestras con nivel por debajo se dibujan en negro en vez
// del gradiente normal. Es un filtro puramente visual sobre los niveles ya
// capturados; no manda ningún comando al receptor (distinto del squelch de
// audio real, config/squelch.json / setSquelch(), que es otra cosa).
const BANDSCOPE_SQUELCH_MIN = 0;
const BANDSCOPE_SQUELCH_MAX = 255;
const rutaBandscopeSquelch = '/Users/danielMac/ws/workspace/radio02/config/bandscopeSquelch.json';

function bandscopeReadSquelch() {
  const n = Math.round(Number(fs.readFileSync(rutaBandscopeSquelch, 'utf-8')));
  if (Number.isNaN(n)) {
    return BANDSCOPE_SQUELCH_MIN;
  }
  return Math.max(BANDSCOPE_SQUELCH_MIN, Math.min(BANDSCOPE_SQUELCH_MAX, n));
}

// Paso de sintonía (el mismo índice 1-22 que usan los botones "Salto -"/"Salto +"
// en Controles), en Hz. Para el bandscope sólo son válidos los pasos entre
// 0.1 y 100 KHz (índices 5 a 18): por abajo de eso barrer no aporta nada
// útil, y por arriba el campo de paso del comando ME00001... (6 dígitos
// decimales) ya no da para más sin arriesgarse a un comando mal formado.
const TUNING_STEP_HZ = {
  1: 1, 2: 10, 3: 20, 4: 50, 5: 100, 6: 500, 7: 1000, 8: 2500, 9: 5000,
  10: 6250, 11: 9000, 12: 10000, 13: 12500, 14: 20000, 15: 25000, 16: 30000,
  17: 50000, 18: 100000, 19: 500000, 20: 1000000, 21: 6000000, 22: 10000000,
};
const BANDSCOPE_MIN_STEP_INDEX = 5;  // 100 Hz = 0.1 KHz
const BANDSCOPE_MAX_STEP_INDEX = 18; // 100000 Hz = 100 KHz
const rutaTuningStepFile = '/Users/danielMac/ws/workspace/radio02/config/tuningStep.json';

function bandscopeReadStepIndex() {
  const idx = Number(fs.readFileSync(rutaTuningStepFile, 'utf-8'));
  if (!TUNING_STEP_HZ[idx]) {
    return 13;
  }
  return Math.max(BANDSCOPE_MIN_STEP_INDEX, Math.min(BANDSCOPE_MAX_STEP_INDEX, idx));
}

function bandscopeReadStepHz() {
  return TUNING_STEP_HZ[bandscopeReadStepIndex()];
}

let bandscopeActive = false;
let bandscopeRxBuffer = '';
let bandscopeSweep = { p70: null, p80: null };
let bandscopeRows = [];
let bandscopeRowSeq = 0;
let bandscopePollTimer = null;
const BANDSCOPE_MAX_ROWS = 300;
// NE1 + nº de paquete (2 hex) + 32 hex de datos (16 muestras) + 1 char descartable
const NE1_PACKET_RE = /NE1([0-9A-Fa-f]{2})([0-9A-Fa-f]{32})[0-9A-Fa-f]/;

// Estado del barrido panorámico (varios segmentos contiguos formando una
// sola fila). panoramaSegments <= 1 significa "sin panorámica": se usa el
// camino de siempre (un solo comando ME, sin tocar la frecuencia).
// panoramaHalves[i] son las muestras por lado con las que se armó CADA
// segmento del barrido en curso — se congela al arrancar (bandscopeStart)
// para que construir/leer los comandos de un barrido activo no dependa de
// que Ancho/Salto sigan igual mientras tanto.
let panoramaSegments = 1;
let panoramaCenters = [];
let panoramaHalves = [16];
let panoramaIndex = 0;
let panoramaAccum = [];
let panoramaOriginalCenterHz = null;
let panoramaSettleTimer = null;

// Cantidad de segmentos elegida con "Ancho -/+" (bandscopeWidth.json guarda
// directamente ese número entero, ya no un ancho en KHz).
function bandscopeComputeSegmentCount() {
  const n = Math.round(Number(fs.readFileSync(rutaBandscopeWidth, 'utf-8')));
  if (!n || n < 1) {
    return 1;
  }
  return Math.min(n, BANDSCOPE_MAX_SEGMENTS);
}

// Muestras por lado de cada segmento del plan actual: siempre el máximo
// (16), uno por cada segmento elegido en "Ancho". El ancho logrado sale de
// multiplicar esto por el paso, así que depende directamente de "Salto".
function bandscopeComputeHalves() {
  return new Array(bandscopeComputeSegmentCount()).fill(16);
}

function bandscopeBuildCommand(on) {
  const half = panoramaHalves[panoramaIndex] || panoramaHalves[0] || 16;
  const samples = half * 2;
  const samplesHex = samples.toString(16).toUpperCase().padStart(2, '0');
  const onOff = on ? '01' : '00';
  const stepHex = String(bandscopeReadStepHz()).padStart(6, '0');
  return 'ME00001' + samplesHex + '05' + onOff + '00' + stepHex;
}

function bandscopeSendCommand(cmd) {
  portcom.write(cmd + '\r\n', (err) => {
    if (err) {
      console.error('Error al escribir en el puerto (bandscope):', err.message);
    }
  });
}

function bandscopePoll() {
  const chunk = portcom.read();
  if (chunk === null || chunk === undefined) {
    return;
  }
  const chunkStr = Buffer.from(chunk).toString();
  bandscopeRxBuffer += chunkStr;
  if (bandscopeRxBuffer.length > 4000) {
    bandscopeRxBuffer = bandscopeRxBuffer.slice(-2000);
  }

  let match;
  while ((match = bandscopeRxBuffer.match(NE1_PACKET_RE))) {
    const packetNum = match[1].toUpperCase();
    const dataHex = match[2].toUpperCase();
    bandscopeRxBuffer = bandscopeRxBuffer.slice(match.index + match[0].length);

    if (packetNum !== '70' && packetNum !== '80') {
      continue;
    }
    const bytes = [];
    for (let i = 0; i < 32; i += 2) {
      bytes.push(parseInt(dataHex.substring(i, i + 2), 16));
    }
    if (packetNum === '70') {
      bandscopeSweep.p70 = bytes;
    } else {
      bandscopeSweep.p80 = bytes;
    }

    if (!bandscopeSweep.p70 || !bandscopeSweep.p80) {
      continue;
    }

    const half = panoramaHalves[panoramaIndex] || panoramaHalves[0] || 16;
    const below = bandscopeSweep.p70.slice(0, half).reverse();
    const aboveAndCenter = bandscopeSweep.p80.slice(0, half);
    const segmentLevels = [...below, ...aboveAndCenter];
    bandscopeSweep = { p70: null, p80: null };

    if (panoramaSegments <= 1) {
      bandscopeRowSeq += 1;
      bandscopeRows.push({ seq: bandscopeRowSeq, levels: segmentLevels });
      if (bandscopeRows.length > BANDSCOPE_MAX_ROWS) {
        bandscopeRows.shift();
      }
      continue;
    }

    // Modo panorámico: acumular el segmento y, recién cuando se juntaron
    // todos, empujar una única fila (más ancha) al historial.
    panoramaAccum.push(...segmentLevels);
    panoramaIndex += 1;
    if (panoramaIndex >= panoramaSegments) {
      bandscopeRowSeq += 1;
      bandscopeRows.push({ seq: bandscopeRowSeq, levels: panoramaAccum });
      if (bandscopeRows.length > BANDSCOPE_MAX_ROWS) {
        bandscopeRows.shift();
      }
      panoramaAccum = [];
      panoramaIndex = 0;
    }
    if (bandscopeActive) {
      bandscopePanoramaAdvance();
    }
    // El resto del buffer (si queda algo) pertenece al segmento que se
    // acaba de dejar atrás; se descarta acá y se retoma en el próximo poll,
    // ya resintonizado, para no procesar dos segmentos en el mismo ciclo.
    break;
  }
}

// bandscopeComputeSegmentCount() (arriba) es de sólo lectura, así
// /bandscope-rows puede mostrar la cantidad de segmentos
// en todo momento con el Salto/Ancho actuales, incluso con el barrido
// detenido — si no, "Ancho -/+" no daba ninguna señal visible hasta tocar
// Disparar. bandscopePlanSegments() sí escribe el estado real del barrido
// (panoramaSegments/panoramaCenters/panoramaHalves), y se llama recién al
// arrancar.
function bandscopePlanSegments() {
  const stepHz = bandscopeReadStepHz();
  const halves = bandscopeComputeHalves();
  const centerHz = Number(fs.readFileSync('/Users/danielMac/ws/workspace/radio02/config/ffrequency.json', 'utf-8'));

  // Centros contiguos: el borde derecho de un segmento coincide con el
  // izquierdo del siguiente (frecuencia final del segmento anterior + el
  // paso). Se acomodan uno atrás del otro a partir del borde izquierdo del
  // primero.
  const widthsHz = halves.map((h) => h * 2 * stepHz);
  const totalHz = widthsHz.reduce((a, b) => a + b, 0);
  const centers = [];
  let cursor = centerHz - totalHz / 2;
  for (let i = 0; i < widthsHz.length; i++) {
    centers.push(cursor + widthsHz[i] / 2);
    cursor += widthsHz[i];
  }

  panoramaSegments = halves.length;
  panoramaCenters = centers;
  panoramaHalves = halves;
  panoramaIndex = 0;
}

function bandscopeTuneToCenter(hz) {
  const rutamode = '/Users/danielMac/ws/workspace/radio02/config/mode.json';
  const rutawide = '/Users/danielMac/ws/workspace/radio02/config/wide.json';
  const moded = fs.readFileSync(rutamode, 'utf-8');
  const wided = fs.readFileSync(rutawide, 'utf-8');
  let ModeSetting;
  switch (moded) {
    case "0": ModeSetting = "00"; break;
    case "1": ModeSetting = "01"; break;
    case "2": ModeSetting = "02"; break;
    case "3": ModeSetting = "03"; break;
    case "5": ModeSetting = "05"; break;
    case "6": ModeSetting = "06"; break;
    default: ModeSetting = "00";
  }
  let FilterSetting;
  switch (wided) {
    case "1": FilterSetting = "00"; break;
    case "2": FilterSetting = "01"; break;
    case "3": FilterSetting = "02"; break;
    case "4": FilterSetting = "03"; break;
    case "5": FilterSetting = "04"; break;
    default: FilterSetting = "02";
  }
  const freqStr = String(Math.round(hz)).padStart(10, '0');
  const cmd = 'K0' + freqStr + ModeSetting + FilterSetting + '00';
  console.log('[bandscope] resintonizando a', hz, 'Hz:', cmd);
  bandscopeSendCommand(cmd);
}

function bandscopePanoramaAdvance() {
  if (bandscopePollTimer) {
    clearInterval(bandscopePollTimer);
    bandscopePollTimer = null;
  }
  bandscopeTuneToCenter(panoramaCenters[panoramaIndex]);
  panoramaSettleTimer = setTimeout(() => {
    panoramaSettleTimer = null;
    if (!bandscopeActive) {
      return;
    }
    bandscopeSweep = { p70: null, p80: null };
    bandscopeRxBuffer = '';
    bandscopeSendCommand(bandscopeBuildCommand(true));
    bandscopePollTimer = setInterval(bandscopePoll, 100);
  }, BANDSCOPE_SEGMENT_SETTLE_MS);
}

function bandscopeStart() {
  if (panoramaSettleTimer) {
    clearTimeout(panoramaSettleTimer);
    panoramaSettleTimer = null;
  }
  bandscopeSweep = { p70: null, p80: null };
  bandscopeRxBuffer = '';
  bandscopeActive = true;
  bandscopePlanSegments();

  if (panoramaSegments <= 1) {
    panoramaOriginalCenterHz = null;
    const cmd = bandscopeBuildCommand(true);
    console.log('[bandscope] enviando G301 (autoupdate ON) + comando ON:', cmd);
    bandscopeSendCommand('G301');
    bandscopeSendCommand(cmd);
    if (!bandscopePollTimer) {
      bandscopePollTimer = setInterval(bandscopePoll, 100);
    }
    return;
  }

  panoramaOriginalCenterHz = Number(fs.readFileSync('/Users/danielMac/ws/workspace/radio02/config/ffrequency.json', 'utf-8'));
  panoramaIndex = 0;
  panoramaAccum = [];
  console.log('[bandscope] panorámico:', panoramaSegments, 'segmentos, centro original', panoramaOriginalCenterHz);
  bandscopeSendCommand('G301');
  bandscopePanoramaAdvance();
}

function bandscopeStop() {
  if (panoramaSettleTimer) {
    clearTimeout(panoramaSettleTimer);
    panoramaSettleTimer = null;
  }
  const cmd = bandscopeBuildCommand(false);
  console.log('[bandscope] enviando comando OFF:', cmd);
  bandscopeSendCommand(cmd);
  bandscopeActive = false;
  if (bandscopePollTimer) {
    clearInterval(bandscopePollTimer);
    bandscopePollTimer = null;
  }
  if (panoramaOriginalCenterHz != null) {
    bandscopeTuneToCenter(panoramaOriginalCenterHz);
    panoramaOriginalCenterHz = null;
  }
  panoramaSegments = 1;
  panoramaCenters = [];
  panoramaIndex = 0;
  panoramaAccum = [];
}
//********************* */

app.use(express.json());

app.post('/enviar-dato', (req, res) => {
  const { dato } = req.body;
  const datoFijo = '(devuelto)';
  const retorno = '\r\n';

//********************* *

function signalStrength() {
    let sendCommand = '';
    let retorno = '\r\n'; 
    let vuelta= 0;
   sendCommand = "I1?";
   sendCommand = sendCommand.replace(/[\'"]+/g, '') + retorno;

   portcom.write(sendCommand);

    setTimeout(() => {
      console.log('primero');
    }, 500);
    portcom.write(sendCommand);
    setTimeout(() => {
      console.log('segundo');
    }, 500);
    let respuesta = portcom.read();
    if (respuesta === null || respuesta === undefined) {
      console.log('No hay datos disponibles del puerto serial');
      return;
    }

   const intervalId = setInterval(() => {
   if (bandscopeActive) {
     return; // no competir por el puerto serie mientras el bandscope está activo
   }
   portcom.write(sendCommand, (err) => {
     if (err) {
       return console.error('Error al escribir en el puerto:', err.message);
     }
    let respuesta = portcom.read();
    let respuesta1 = respuesta;
    if (respuesta1 === null || respuesta1 === undefined) {
      return; // Salir si no hay datos
    }
    
               //console.log (respuesta); 
     
               let buf = Buffer.from(respuesta);
               respuesta = buf.toString();
               let respuesta2 = parseInt(respuesta.substring(3,4),16);
               let respuesta3 = parseInt(respuesta.substring(4,5),16);
               const respuesta4 = respuesta2 * 16 + respuesta3;
               console.log(respuesta4);
   
               const sendComandd1 = respuesta4;
               const configJSON1 = JSON.stringify(sendComandd1, null, 2); 
               let rutaenvio1 = '/Users/danielMac/ws/workspace/radio02/config/signalStrength.json';
              fs.writeFileSync(rutaenvio1, configJSON1, 'utf8', (err) => {
               if (err) {
                 console.error('Error al escribir en el archivo:', err);
                  return;
              }
              }
            );

                let rutaenvio = '/Users/danielMac/ws/workspace/radio02/config/envio.json';
                let apagado= fs.readFileSync(rutaenvio, 'utf-8');
                apagado= apagado.replace(/[\'"]+/g, '') ;
                if (apagado === 'H100') {
                 clearInterval(intervalId);
                }
   });
  }, 500);
 }

function enviar() {
  let sendCommand = '';
  const rutaenvio = '/Users/danielMac/ws/workspace/radio02/config/envio.json';
  sendCommand = fs.readFileSync(rutaenvio, 'utf-8');
  sendCommand = sendCommand.replace(/[\'"]+/g, '') + retorno;
  portcom.write(sendCommand, (err) => {
    if (err) {
      return console.error('Error al escribir en el puerto:', err.message);
    }
    console.log(sendCommand);
    //console.log('Datos enviados correctamente');
  });
}
//********************* */
function setAFC() {
  let afcd = '';
  let sendCommand = '';
  const rutaafc = '/Users/danielMac/ws/workspace/radio02/config/afc.json';
  afcd = fs.readFileSync(rutaafc, 'utf-8');
    switch (afcd) {
      case "0":
        sendCommand = 5000;
      break;
      case "1":
        sendCommand = 5001;
      break;
      default:
        sendCommand = 5000;
    }
    const sendComandd = "J"+ sendCommand;
    const configJSON = JSON.stringify(sendComandd, null, 2); 
    const rutaenvio = '/Users/danielMac/ws/workspace/radio02/config/envio.json';
    fs.writeFileSync(rutaenvio, configJSON, 'utf8', (err) => {
      if (err) {
       console.error('Error al escribir en el archivo:', err);
        return;
      }});
      enviar();
}
//********************* */
function setAGC() {
  let agcd = '';
  let sendCommand = '';
  const rutaagc = '/Users/danielMac/ws/workspace/radio02/config/agc.json';
  agcd = fs.readFileSync(rutaagc, 'utf-8');
    switch (agcd) {
      case "0":
        sendCommand = 4500;
      break;
      case "1":
        sendCommand = 4501;
      break;
      default:
        sendCommand = 4500;
    }
    const sendComandd = "J"+ sendCommand;
    const configJSON = JSON.stringify(sendComandd, null, 2); 
    const rutaenvio = '/Users/danielMac/ws/workspace/radio02/config/envio.json';
    fs.writeFileSync(rutaenvio, configJSON, 'utf8', (err) => {
      if (err) {
       console.error('Error al escribir en el archivo:', err);
        return;
      }});
      enviar();
}
//********************* */
function estaEnRango() {

  let moded = '';
  let tuningStepd = '';
  let wided = '';

  const rutaffrequency = '/Users/danielMac/ws/workspace/radio02/config/ffrequency.json';
  let ffrequencyd = fs.readFileSync(rutaffrequency, 'utf-8');
  const ffrequency = Number(ffrequencyd);
console.log(ffrequency);
  switch (true) {
      case (ffrequency > 100000 && ffrequency < 529000):
          moded = '2';
          wided = "2";
          tuningStepd = "9";
          break;
      case (ffrequency > 529000 && ffrequency < 1620000):
          moded = '2';
          wided = "2";
          tuningStepd = "12";
          break;
      case (ffrequency > 1620000 && ffrequency < 3500000):
          moded = '2';
          wided = "2";
          tuningStepd = "9";
          break;
      case (ffrequency > 3500000 && ffrequency < 3800000): //80 metros
          moded = '0';
          wided = "1";
          tuningStepd = "5";
          break;
      case (ffrequency > 3800000 && ffrequency < 7000000):
          moded = '2';
          wided = "2";
          tuningStepd = "9";
          break;
      case (ffrequency > 7000000 && ffrequency < 7300000): //40metros
          moded = '0';
          wided = "1";
          tuningStepd = "5";
          break;
      case (ffrequency > 7300000 && ffrequency < 30000000):
          moded = '2';
          wided = "2";
          tuningStepd = "9";
          break;
      case (ffrequency > 30000000 && ffrequency < 54000000): 
          moded = '5';
          wided = "3";
          tuningStepd = "12";
          break;
      case (ffrequency > 54000000 && ffrequency < 87000000): //TV
          moded = '6';
          wided = "5";
          tuningStepd = "21";
          break;
      case (ffrequency > 87000000 && ffrequency < 108900000):
          moded = '6';
          wided = "5";
          tuningStepd = "18";
          break;
      case (ffrequency > 108900000 && ffrequency < 170000000):
          moded = '2';
          wided = "2";
          tuningStepd = "9";
          break;
      case (ffrequency > 170000000 && ffrequency < 216000000): //TV
          moded = '6';
          wided = "5";
          tuningStepd = "21";
          break;
      case (ffrequency > 216000000 && ffrequency < 136000000):
          moded = '2';
          wided = "2";
          tuningStepd = "15";
          break;
      case (ffrequency > 136000000 && ffrequency < 170000000):
          moded = '5';
          wided = "3";
          tuningStepd = "12";
          break;
      case (ffrequency > 170000000 && ffrequency < 225000000):
          moded = '6';
          Filter5 = True
          tuningStepd = "17";
          break;
      case (ffrequency > 225000000 && ffrequency < 500000000):
          moded = '5';
          wided = "3";
          tuningStepd = "12";
          break;
      case (ffrequency > 500000000 && ffrequency < 807000000): //TV
          moded = '6';
          wided = "5";
          tuningStepd = "21";
          break;
      case (ffrequency > 807000000 && ffrequency < 950000000):
          moded = '5';
          wided = "3";
          tuningStepd = "12.5 KHz"
          break;
      case (ffrequency > 950000000 && ffrequency < 1300000000):
          moded = '5';
          wided = "3";
          tuningStepd = "12";
          break;
      default:
          moded = '2';
          wided = "2";
          tuningStepd = "12";

};
  const mode = Number(moded);
  const rutamode = '/Users/danielMac/ws/workspace/radio02/config/mode.json';
  const configJSON = JSON.stringify(mode, null, 2); 
  fs.writeFileSync(rutamode, configJSON, 'utf8', (err) => {
    if (err) {
     console.error('Error al escribir en el archivo:', err);
      return;
  }});

  const tuningStep = Number(tuningStepd);
  const rutatuningStep = '/Users/danielMac/ws/workspace/radio02/config/tuningStep.json';
  const configJSON1 = JSON.stringify(tuningStep, null, 2); 
  fs.writeFileSync(rutatuningStep, configJSON1, 'utf8', (err) => {
    if (err) {
     console.error('Error al escribir en el archivo:', err);
      return;
  }});

  const wide = Number(wided);
  const rutawide = '/Users/danielMac/ws/workspace/radio02/config/wide.json';
  const configJSON2 = JSON.stringify(wide, null, 2); 
  fs.writeFileSync(rutawide, configJSON2, 'utf8', (err) => {
    if (err) {
     console.error('Error al escribir en el archivo:', err);
      return;
  }});
}
//********************* */
function setATT() {
  let attd = '';
  const rutaatt = '/Users/danielMac/ws/workspace/radio02/config/att.json';
  attd = fs.readFileSync(rutaatt, 'utf-8');
  let sendCommand = '';
    switch (attd) {
      case "0":
        sendCommand = 4700;
      break;
      case "1":
        sendCommand = 4701;
      break;
      default:
        sendCommand = 4700;
    }
    const sendComandd = "J"+ sendCommand;
    const configJSON = JSON.stringify(sendComandd, null, 2); 
    const rutaenvio = '/Users/danielMac/ws/workspace/radio02/config/envio.json';
    fs.writeFileSync(rutaenvio, configJSON, 'utf8', (err) => {
      if (err) {
       console.error('Error al escribir en el archivo:', err);
        return;
      }});
      enviar();
}
//********************* */
function setNB() {
  let nbd = '';
  const rutanb = '/Users/danielMac/ws/workspace/radio02/config/nb.json';
  nbd = fs.readFileSync(rutanb, 'utf-8');
  let sendCommand = '';
    switch (nbd) {
      case "0":
        sendCommand = 4600;
      break;
      case "1":
        sendCommand = 4601;
      break;
      default:
        sendCommand = 4600;
    }
    const sendComandd = "J"+ sendCommand;
    const configJSON = JSON.stringify(sendComandd, null, 2); 
    const rutaenvio = '/Users/danielMac/ws/workspace/radio02/config/envio.json';
    fs.writeFileSync(rutaenvio, configJSON, 'utf8', (err) => {
      if (err) {
       console.error('Error al escribir en el archivo:', err);
        return;
      }});
      enviar();
}
//********************* */
function datosDisplay() {
  const rutavolume = '/Users/danielMac/ws/workspace/radio02/config/volume.json';
  const volume = fs.readFileSync(rutavolume, 'utf-8');

  const rutamode = '/Users/danielMac/ws/workspace/radio02/config/mode.json';
  const mode = fs.readFileSync(rutamode, 'utf-8');

  const rutaafc = '/Users/danielMac/ws/workspace/radio02/config/afc.json';
  const afc = fs.readFileSync(rutaafc, 'utf-8');

  const rutaagc = '/Users/danielMac/ws/workspace/radio02/config/agc.json';
  const agc = fs.readFileSync(rutaagc, 'utf-8');

  const rutaatt = '/Users/danielMac/ws/workspace/radio02/config/att.json';
  const att = fs.readFileSync(rutaatt, 'utf-8');

  const rutanb = '/Users/danielMac/ws/workspace/radio02/config/nb.json';
  const nb = fs.readFileSync(rutanb, 'utf-8');

  const rutawide = '/Users/danielMac/ws/workspace/radio02/config/wide.json';
  const wide = fs.readFileSync(rutawide, 'utf-8');

  const rutatuningStep = '/Users/danielMac/ws/workspace/radio02/config/tuningStep.json';
  const tuningStep = fs.readFileSync(rutatuningStep, 'utf-8');

  const rutaffrequency = '/Users/danielMac/ws/workspace/radio02/config/ffrequency.json';
  const ffrequency = fs.readFileSync(rutaffrequency, 'utf-8');

  const rutasignalStrength = '/Users/danielMac/ws/workspace/radio02/config/signalStrength.json';
  const signalStrength = fs.readFileSync(rutasignalStrength, 'utf-8');

  const rutagrado = '/Users/danielMac/ws/workspace/radio02/config/grados.json';
  let grados = fs.readFileSync(rutagrado, 'utf-8');

  let tuningStepd ='nada'
  if (tuningStep === "1") {
    tuningStepd = "1 Hz";
  };
  if (tuningStep === "2") {
    tuningStepd = "10 Hz";
  };
  if (tuningStep === "3") {
    tuningStepd = "20 Hz";
  };
  if (tuningStep === "4") {
    tuningStepd = "50 Hz";
  };
  if (tuningStep === "5") {
    tuningStepd = "100 Hz";
  };
  if (tuningStep === "6") {
    tuningStepd = "500 Hz";
  };
  if (tuningStep === "7") {
    tuningStepd = "1 KHz";
  };
  if (tuningStep === "8") {
    tuningStepd = "2.5 KHz";
  };
  if (tuningStep === "9") {
    tuningStepd = "5 KHz";
  };
  if (tuningStep === "10") {
    tuningStepd = "6.25 KHz";
  };
  if (tuningStep === "11") {
    tuningStepd = "9 KHz";
  };
  if (tuningStep === "12") {
    tuningStepd = "10 KHz";
  };
  if (tuningStep === "13") {
    tuningStepd = "12.5 KHz";
  };
  if (tuningStep === "14") {
    tuningStepd = "20 KHz";
  };
  if (tuningStep === "15") {
    tuningStepd = "25 KHz";
  };
  if (tuningStep === "16") {
    tuningStepd = "30 KHz";
  };
  if (tuningStep === "17") {
    tuningStepd = "50 KHz";
  };
  if (tuningStep === "18") {
    tuningStepd = "100 KHz";
  };
  if (tuningStep === "19") {
    tuningStepd = "500 KHz";
  };
  if (tuningStep === "20") {
    tuningStepd = "1 MHz";
  };
  if (tuningStep === "21") {
    tuningStepd = "6 MHz";
  };
  if (tuningStep === "22") {
    tuningStepd = "10 MHz";
  };

let modulado ='nada'
  if (mode === "0") {
     modulado = "LSB";
  };
  if (mode === "1") {
    modulado = "USB";
 };
 if (mode === "2") {
  modulado = "AM";
};
if (mode === "3") {
  modulado = "CW";
};
if (mode === "5") {
  modulado = "FM";
};
if (mode === "6") {
  modulado = "WFM";
};
let afcc =''
  if (afc === '1') {
  afcc = "AFC";
} else if (afc === "0" ){
  afcc = "----";
};
let agcc =''
  if (agc === "1") {
  agcc = "AGC";
} else if (agc === "0" ){
  agcc = "----";
};
let attc =''
  if (att === "1") {
  attc = "ATT";
} else if (att === "0" ){
  attc = "----";
};
let nbc =''
  if (nb === "1") {
  nbc = "NB";
} else if (nb === "0" ){
  nbc = "---";
};
let wided ="";
switch (wide) {
  case "1":
    wided = "2.8 KHz";
    break;
  case "2":
    wided = "6 KHz";
    break;
  case "3":
    wided = "15 KHz";
    break;
  case "4":
    wided = "50 KHz";
    break;
  case "5":
    wided = "230 KHz";
    break;
}

let ffrequencyd = Number(ffrequency);
ffrequencyd = ffrequencyd.toString().padStart(10, '0') ;
let ffrequencyd1=ffrequencyd.substr(0, 1);
let ffrequencyd2=ffrequencyd.substr(1, 3);
let ffrequencyd3=ffrequencyd.substr(4, 3);
let ffrequencyd4=ffrequencyd.substr(7, 3);
ffrequencyd = ffrequencyd1 + "." + ffrequencyd2 + "," + ffrequencyd3 + "." + ffrequencyd4;
const spaces = 'vol: '.padStart(19, "\ \ ");
  res.json({ dato: ffrequencyd +' Mhz'+ ' ' + modulado + ' w:' + wided + ' ts:' + tuningStepd + "&"  + afcc + ' ' + agcc + ' ' + attc + ' ' + nbc  + spaces +  volume + '  ' + signalStrength + '  ' + grados + 'º' +  '  ' + '(' + dato.substring(4) + ')' });
}
//****************************************** */
function setVolume() {
  const rutavolume = '/Users/danielMac/ws/workspace/radio02/config/volume.json';
  let volumed =''
  volumed = fs.readFileSync(rutavolume, 'utf-8');
  volumed  = Number(volumed);
  volumed = volumed.toString(16);
  volumed = volumed.toUpperCase();
  let sendCommand  =  "J40" + volumed;
  const sendComandd = sendCommand;
    const configJSON = JSON.stringify(sendComandd, null, 2); 
    const rutaenvio = '/Users/danielMac/ws/workspace/radio02/config/envio.json';
    fs.writeFileSync(rutaenvio, configJSON, 'utf8', (err) => {
      if (err) {
       console.error('Error al escribir en el archivo:', err);
        return;
      }});
      enviar();
}
//****************************************** */
function setSquelch() {
  const rutasquelch = '/Users/danielMac/ws/workspace/radio02/config/squelch.json';
  let squelchd =''
 squelchd = fs.readFileSync(rutasquelch, 'utf-8');
  squelchd  = Number(squelchd);
  squelchd = squelchd.toString(16);
  squelchd = squelchd.toUpperCase();
  //let sendCommand  =  "J41" + squelchd;
  let sendCommand  =  "J4100";
  const sendComandd = sendCommand;
  const configJSON = JSON.stringify(sendComandd, null, 2); 
  const rutaenvio = '/Users/danielMac/ws/workspace/radio02/config/envio.json';
  fs.writeFileSync(rutaenvio, configJSON, 'utf8', (err) => {
    if (err) {
     console.error('Error al escribir en el archivo:', err);
      return;
    }});
    enviar();
}
//****************************************** */
function setIfshift() {
  const rutasIfshift = '/Users/danielMac/ws/workspace/radio02/config/Ifshift.json';
  let Ifshiftd =''
  Ifshiftd = fs.readFileSync(rutasIfshift, 'utf-8');
  Ifshiftd  = Number(Ifshiftd);
  Ifshiftd = Ifshiftd.toString(16);
  Ifshiftd = Ifshiftd.toUpperCase();
  let sendCommand  =  "J43" + Ifshiftd;
  const sendComandd = sendCommand;
  const configJSON = JSON.stringify(sendComandd, null, 2); 
  const rutaenvio = '/Users/danielMac/ws/workspace/radio02/config/envio.json';
  fs.writeFileSync(rutaenvio, configJSON, 'utf8', (err) => {
    if (err) {
     console.error('Error al escribir en el archivo:', err);
      return;
    }});
    enviar();
}
//****************************************** */
function TuneIn() {
  const rutawide = '/Users/danielMac/ws/workspace/radio02/config/wide.json';
  let wided;
  let FilterSetting;
  wided = fs.readFileSync(rutawide, 'utf-8');
      switch (wided) {
          case "1":
          FilterSetting = "00";
          break;
          case "2":
          FilterSetting = "01";
          break;
          case "3":
          FilterSetting = "02";
          break;
          case "4":
          FilterSetting = "03";
          break;
          case "5":
          FilterSetting = "04";
          break;
          default:
            FilterSetting = "02";
      }
  const rutamode = '/Users/danielMac/ws/workspace/radio02/config/mode.json';
  let moded;
  let ModeSetting;
  moded = fs.readFileSync(rutamode, 'utf-8');
      switch (moded) {
        case "0":
        ModeSetting = "00";
        break;
        case "1":
        ModeSetting = "01";
        break;
        case "2":
        ModeSetting = "02";
        break;
        case "3":
        ModeSetting = "03";
        break;
        case "5":
        ModeSetting = "05";
        break;
        case "6":
        ModeSetting = "06";
        break;
        default:
          ModeSetting = "00";
      }
      const rutaffrequency = '/Users/danielMac/ws/workspace/radio02/config/ffrequency.json';
      const ffrequency = fs.readFileSync(rutaffrequency, 'utf-8');
      let ffrequencyd = Number(ffrequency);
      ffrequencyd = ffrequency.toString().padStart(10, '0') ;
      
  let sendCommand  =  "K0" + ffrequencyd + ModeSetting + FilterSetting + "00";
  const sendComandd = sendCommand;
  const configJSON = JSON.stringify(sendComandd, null, 2); 
  const rutaenvio = '/Users/danielMac/ws/workspace/radio02/config/envio.json';
  fs.writeFileSync(rutaenvio, configJSON, 'utf8', (err) => {
    if (err) {
     console.error('Error al escribir en el archivo:', err);
      return;
    }});
    enviar();
}
//****************************************** */
const datonum = dato.substring(0,4);
const datodato = dato.substring(4);
  switch (datodato) {
  case 'freq_do-1': {
    const rutatuningStep = '/Users/danielMac/ws/workspace/radio02/config/tuningStep.json';
    let tuningStepd =''
    tuningStepd = fs.readFileSync(rutatuningStep, 'utf-8');  

    if (tuningStepd === "1") {
      tuningStepd = "1";
    };
    if (tuningStepd === "2") {
      tuningStepd = "10";
    };
    if (tuningStepd === "3") {
      tuningStepd = "20";
    };
    if (tuningStepd === "4") {
      tuningStepd = "50";
    };
    if (tuningStepd === "5") {
      tuningStepd = "100";
    };
    if (tuningStepd === "6") {
      tuningStepd = "500";
    };
    if (tuningStepd === "7") {
      tuningStepd = "1000";
    };
    if (tuningStepd === "8") {
      tuningStepd = "2500";
    };
    if (tuningStepd === "9") {
      tuningStepd = "5000";
    };
    if (tuningStepd === "10") {
      tuningStepd = "6250";
    };
    if (tuningStepd === "11") {
      tuningStepd = "9000";
    };
    if (tuningStepd === "12") {
      tuningStepd = "10000";
    };
    if (tuningStepd === "13") {
      tuningStepd = "12500";
    };
    if (tuningStepd === "14") {
      tuningStepd = "20000";
    };
    if (tuningStepd === "15") {
      tuningStepd = "25000";
    };
    if (tuningStepd === "16") {
      tuningStepd = "30000";
    };
    if (tuningStepd === "17") {
      tuningStepd = "50000";
    };
    if (tuningStepd === "18") {
      tuningStepd = "100000";
    };
    if (tuningStepd === "19") {
      tuningStepd = "500000";
    };
    if (tuningStepd === "20") {
      tuningStepd = "1000000";
    };
    if (tuningStepd === "21") {
      tuningStepd = "6000000";
    };
    if (tuningStepd === "22") {
      tuningStepd = "10000000";
    };

    let ffrequencyd = ""
    const rutaffrequency = '/Users/danielMac/ws/workspace/radio02/config/ffrequency.json';
    ffrequencyd = fs.readFileSync(rutaffrequency, 'utf-8');
    ffrequencyd  = Number(ffrequencyd) - Number(tuningStepd);
      if (ffrequencyd < 100000) {
        ffrequencyd =1300000000;
      }
    const ffrequency = ffrequencyd;
    const configJSON = JSON.stringify(ffrequency, null, 2); 
    fs.writeFileSync(rutaffrequency, configJSON, 'utf8', (err) => {
      if (err) {
       console.error('Error al escribir en el archivo:', err);
        return;
  }});
    TuneIn();
    datosDisplay();
    break;}
//****************************************** */
case 'freq_up-1': {
  const rutatuningStep = '/Users/danielMac/ws/workspace/radio02/config/tuningStep.json';
  let tuningStepd =''
  tuningStepd = fs.readFileSync(rutatuningStep, 'utf-8');  

  if (tuningStepd === "1") {
    tuningStepd = "1";
  };
  if (tuningStepd === "2") {
    tuningStepd = "10";
  };
  if (tuningStepd === "3") {
    tuningStepd = "20";
  };
  if (tuningStepd === "4") {
    tuningStepd = "50";
  };
  if (tuningStepd === "5") {
    tuningStepd = "100";
  };
  if (tuningStepd === "6") {
    tuningStepd = "500";
  };
  if (tuningStepd === "7") {
    tuningStepd = "1000";
  };
  if (tuningStepd === "8") {
    tuningStepd = "2500";
  };
  if (tuningStepd === "9") {
    tuningStepd = "5000";
  };
  if (tuningStepd === "10") {
    tuningStepd = "6250";
  };
  if (tuningStepd === "11") {
    tuningStepd = "9000";
  };
  if (tuningStepd === "12") {
    tuningStepd = "10000";
  };
  if (tuningStepd === "13") {
    tuningStepd = "12500";
  };
  if (tuningStepd === "14") {
    tuningStepd = "20000";
  };
  if (tuningStepd === "15") {
    tuningStepd = "25000";
  };
  if (tuningStepd === "16") {
    tuningStepd = "30000";
  };
  if (tuningStepd === "17") {
    tuningStepd = "50000";
  };
  if (tuningStepd === "18") {
    tuningStepd = "100000";
  };
  if (tuningStepd === "19") {
    tuningStepd = "500000";
  };
  if (tuningStepd === "20") {
    tuningStepd = "1000000";
  };
  if (tuningStepd === "21") {
    tuningStepd = "6000000";
  };
  if (tuningStepd === "22") {
    tuningStepd = "10000000";
  };
  let ffrequencyd = ""
  const rutaffrequency = '/Users/danielMac/ws/workspace/radio02/config/ffrequency.json';
  ffrequencyd = fs.readFileSync(rutaffrequency, 'utf-8');
  ffrequencyd  = Number(ffrequencyd) + Number(tuningStepd);
    if (ffrequencyd > 1300000000) {
     ffrequencyd =100000;
    }
  const ffrequency = ffrequencyd;
  const configJSON = JSON.stringify(ffrequency, null, 2); 
  fs.writeFileSync(rutaffrequency, configJSON, 'utf8', (err) => {
    if (err) {
     console.error('Error al escribir en el archivo:', err);
      return;
}});
  TuneIn();
    datosDisplay();
    break;}
//****************************************** */
case 'ancho_do-1':{
  const rutawide = '/Users/danielMac/ws/workspace/radio02/config/wide.json';
  let wided;
  wided = fs.readFileSync(rutawide, 'utf-8');
  wided = Number(wided) - 1;
    if (wided < 1) {
      wided = 5;
    }
    const wide = wided;
    const configJSON = JSON.stringify(wide, null, 2); 
    fs.writeFileSync(rutawide, configJSON, 'utf8', (err) => {
      if (err) {
       console.error('Error al escribir en el archivo:', err);
        return;
    }});
    TuneIn();
    datosDisplay();
    break;}
//****************************************** */
case 'ancho_up-1':{
  const rutawide = '/Users/danielMac/ws/workspace/radio02/config/wide.json';
  let wided;
  wided = fs.readFileSync(rutawide, 'utf-8');
  wided = Number(wided) + 1;
    if (wided > 5) {
      wided = 1;
    }
    const wide = wided;
    const configJSON = JSON.stringify(wide, null, 2); 
    fs.writeFileSync(rutawide, configJSON, 'utf8', (err) => {
      if (err) {
       console.error('Error al escribir en el archivo:', err);
        return;
    }});
    TuneIn();
    datosDisplay();
    break;}
//****************************************** */

  case 'step_do-1':{
    const rutatuningStep = '/Users/danielMac/ws/workspace/radio02/config/tuningStep.json';
    let tuningStepd =''
    tuningStepd = fs.readFileSync(rutatuningStep, 'utf-8');  
    tuningStepd  = Number(tuningStepd);
    tuningStepd = tuningStepd - 1;
    if (tuningStepd === 0){
      tuningStepd =22;
    }
    const tuningStep = tuningStepd;
    const configJSON = JSON.stringify(tuningStep, null, 2); 
    fs.writeFileSync(rutatuningStep, configJSON, 'utf8', (err) => {
      if (err) {
       console.error('Error al escribir en el archivo:', err);
        return;
  }});
    datosDisplay();
    break;}
//****************************************** */
  case 'step_up-1':{
    const rutatuningStep = '/Users/danielMac/ws/workspace/radio02/config/tuningStep.json';
    let tuningStepd =''
    tuningStepd = fs.readFileSync(rutatuningStep, 'utf-8');  
    tuningStepd  = Number(tuningStepd);

    tuningStepd = tuningStepd + 1;
    if (tuningStepd === 23){
      tuningStepd =1;
    }
    const tuningStep = tuningStepd;
    const configJSON = JSON.stringify(tuningStep, null, 2); 
    fs.writeFileSync(rutatuningStep, configJSON, 'utf8', (err) => {
      if (err) {
       console.error('Error al escribir en el archivo:', err);
        return;
}});
    datosDisplay();
    break;}
//****************************************** */
  case 'modulacion': {
    const rutamode = '/Users/danielMac/ws/workspace/radio02/config/mode.json';
    let moded =''
    moded = fs.readFileSync(rutamode, 'utf-8');
    moded  = Number(moded) + 1;
    if (moded >6) {
      moded =0;
    };
    if (moded === 4) {
      moded =5;
    };
    const mode = moded;

    const configJSON = JSON.stringify(mode, null, 2); 
    fs.writeFileSync(rutamode, configJSON, 'utf8', (err) => {
      if (err) {
       console.error('Error al escribir en el archivo:', err);
        return;
    }});
    TuneIn();
    datosDisplay();
    break;}
//****************************************** */
  case 'encendido': {
     configJSON = JSON.stringify("H101", null, 2); 
     rutaenvio = '/Users/danielMac/ws/workspace/radio02/config/envio.json';
     fs.writeFileSync(rutaenvio, configJSON, 'utf8', (err) => {
       if (err) {
        console.error('Error al escribir en el archivo:', err);
         return;
       }});
       enviar();
     configJSON = JSON.stringify("G300", null, 2); 
     rutaenvio = '/Users/danielMac/ws/workspace/radio02/config/envio.json';
     fs.writeFileSync(rutaenvio, configJSON, 'utf8', (err) => {
       if (err) {
        console.error('Error al escribir en el archivo:', err);
         return;
       }});
       enviar();
      setVolume();
      setSquelch();
      setIfshift();
      setAFC();
      setAGC();
      setATT();
      setNB();
      TuneIn();
     datosDisplay();
     signalStrength();
     break;}
//****************************************** */
  case 'volume_do-1': {
    const rutavolume = '/Users/danielMac/ws/workspace/radio02/config/volume.json';
    let volumed =''
    volumed = fs.readFileSync(rutavolume, 'utf-8');
    volumed  = Number(volumed);
    if (volumed > 0) {
    volumed  = Number(volumed) - 1;
    };
    const volume = volumed;
    const configJSON = JSON.stringify(volume, null, 2); 
    fs.writeFileSync(rutavolume, configJSON, 'utf8', (err) => {
      if (err) {
       console.error('Error al escribir en el archivo:', err);
        return;
    }});
    setVolume(volumed);
    datosDisplay();
    break; }
//****************************************** */
  case 'volume_up-1': {
    const rutavolume = '/Users/danielMac/ws/workspace/radio02/config/volume.json';
    let volumed =''
    volumed = fs.readFileSync(rutavolume, 'utf-8');
    volumed  = Number(volumed);
    if (volumed < 255) {
    volumed  = Number(volumed) + 1;
    };
    const volume = volumed;
    const configJSON = JSON.stringify(volume, null, 2); 
    fs.writeFileSync(rutavolume, configJSON, 'utf8', (err) => {
      if (err) {
       console.error('Error al escribir en el archivo:', err);
        return;
}});
    setVolume(volumed);
    datosDisplay();
    break; }
//****************************************** */
  case 'apagado': {
    configJSON = JSON.stringify("H100", null, 2); 
    rutaenvio = '/Users/danielMac/ws/workspace/radio02/config/envio.json';
    fs.writeFileSync(rutaenvio, configJSON, 'utf8', (err) => {
      if (err) {
       console.error('Error al escribir en el archivo:', err);
        return;
      }});
      enviar();
    datosDisplay();
    break; }
//************************************************************** */
  case 'AFC-1': {
        const rutaafc = '/Users/danielMac/ws/workspace/radio02/config/afc.json';
          let afcd =''
          afcd = fs.readFileSync(rutaafc, 'utf-8');
            if (afcd === "1") {
              afcd = 0;
            } else if (afcd === "0" ){
              afcd = 1;
            };
          const afc = afcd;
          const configJSON = JSON.stringify(afc, null, 2); 
          fs.writeFileSync(rutaafc, configJSON, 'utf8', (err) => {
            if (err) {
             console.error('Error al escribir en el archivo:', err);
              return;
      }});
      setAFC();
    datosDisplay();
    break; }
//************************************************************** */
  case 'AGC-1': {
    const rutaagc = '/Users/danielMac/ws/workspace/radio02/config/agc.json';
    let agcd =''
    agcd = fs.readFileSync(rutaagc, 'utf-8');
      if (agcd === "1") {
        agcd = 0;
      } else if (agcd === "0" ){
        agcd = 1;
      };
    const agc = agcd;
    const configJSON = JSON.stringify(agc, null, 2); 
    fs.writeFileSync(rutaagc, configJSON, 'utf8', (err) => {
      if (err) {
       console.error('Error al escribir en el archivo:', err);
        return;
}});
   setAGC();
    datosDisplay();
    break; }
//************************************************************** */
  case 'ATT-1': {
    const rutaatt = '/Users/danielMac/ws/workspace/radio02/config/att.json';
    let attd =''
    attd = fs.readFileSync(rutaatt, 'utf-8');
      if (attd === "1") {
        attd = 0;
      } else if (attd === "0" ){
        attd = 1;
      };
    const att = attd;
    const configJSON = JSON.stringify(att, null, 2); 
    fs.writeFileSync(rutaatt, configJSON, 'utf8', (err) => {
      if (err) {
       console.error('Error al escribir en el archivo:', err);
        return;
}});
    setATT();
    datosDisplay();
    break; }
//************************************************************** */    
  case 'NB-1': {
    const rutanb = '/Users/danielMac/ws/workspace/radio02/config/nb.json';
    let nbd =''
    nbd = fs.readFileSync(rutanb, 'utf-8');
      if (nbd === "1") {
        nbd = 0;
      } else if (nbd === "0" ){
        nbd = 1;
      };
    const nb = nbd;
    const configJSON = JSON.stringify(nbd, null, 2); 
    fs.writeFileSync(rutanb, configJSON, 'utf8', (err) => {
      if (err) {
       console.error('Error al escribir en el archivo:', err);
        return;
}});
    setNB();
    datosDisplay();
    break; }
//************************************************************** */
  case 'estado-1': {
    // Solo devuelve el último estado guardado, sin tocar el hardware.
    datosDisplay();
    break; }
//************************************************************** */
  case 'bandscope_on': {
    fs.writeFileSync(rutaBandscopeOn, '1', 'utf8', (err) => {
      if (err) {
       console.error('Error al escribir en el archivo:', err);
        return;
      }});
    // Arranca un barrido nuevo: borra el historial de filas para no
    // mezclar en pantalla datos de un barrido anterior con el que empieza.
    bandscopeRows = [];
    bandscopeStart();
    datosDisplay();
    break; }
//************************************************************** */
  case 'bandscope_off': {
    fs.writeFileSync(rutaBandscopeOn, '0', 'utf8', (err) => {
      if (err) {
       console.error('Error al escribir en el archivo:', err);
        return;
      }});
    bandscopeStop();
    datosDisplay();
    break; }
//************************************************************** */
  case 'bandscope_step_up': {
    let stepIdx = Math.min(bandscopeReadStepIndex() + 1, BANDSCOPE_MAX_STEP_INDEX);
    fs.writeFileSync(rutaTuningStepFile, String(stepIdx), 'utf8', (err) => {
      if (err) {
       console.error('Error al escribir en el archivo:', err);
        return;
      }});
    if (bandscopeActive) {
      bandscopeStart();
    }
    datosDisplay();
    break; }
//************************************************************** */
  case 'bandscope_step_do': {
    let stepIdx = Math.max(bandscopeReadStepIndex() - 1, 1);
    fs.writeFileSync(rutaTuningStepFile, String(stepIdx), 'utf8', (err) => {
      if (err) {
       console.error('Error al escribir en el archivo:', err);
        return;
      }});
    if (bandscopeActive) {
      bandscopeStart();
    }
    datosDisplay();
    break; }
//************************************************************** */
  case 'bandscope_width_up': {
    const segments = Math.min(bandscopeComputeSegmentCount() + 1, BANDSCOPE_MAX_SEGMENTS);
    fs.writeFileSync(rutaBandscopeWidth, String(segments), 'utf8', (err) => {
      if (err) {
       console.error('Error al escribir en el archivo:', err);
        return;
      }});
    if (bandscopeActive) {
      bandscopeStart();
    }
    datosDisplay();
    break; }
//************************************************************** */
  case 'bandscope_width_do': {
    const segments = Math.max(bandscopeComputeSegmentCount() - 1, 1);
    fs.writeFileSync(rutaBandscopeWidth, String(segments), 'utf8', (err) => {
      if (err) {
       console.error('Error al escribir en el archivo:', err);
        return;
      }});
    if (bandscopeActive) {
      bandscopeStart();
    }
    datosDisplay();
    break; }
//************************************************************** */
  case 'bandscope_squelch_up': {
    const squelch = Math.min(bandscopeReadSquelch() + 1, BANDSCOPE_SQUELCH_MAX);
    fs.writeFileSync(rutaBandscopeSquelch, String(squelch), 'utf8', (err) => {
      if (err) {
       console.error('Error al escribir en el archivo:', err);
        return;
      }});
    datosDisplay();
    break; }
//************************************************************** */
  case 'bandscope_squelch_do': {
    const squelch = Math.max(bandscopeReadSquelch() - 1, BANDSCOPE_SQUELCH_MIN);
    fs.writeFileSync(rutaBandscopeSquelch, String(squelch), 'utf8', (err) => {
      if (err) {
       console.error('Error al escribir en el archivo:', err);
        return;
      }});
    datosDisplay();
    break; }
//************************************************************** */
  default: {
    const rutagrados = '/Users/danielMac/ws/workspace/radio02/config/grados.json';
    let grados ='';
    if (datonum === 'frec'){
      let punto = datodato.indexOf(".");
      let largo = datodato.length;
      let resto = largo - punto - 1;
      let ffrequencyd1=datodato.slice(0,punto);
      let ffrequencyd2=datodato.slice(-resto);
      let ffrequencyd = ffrequencyd1.toString().padStart(4, '0')  + ffrequencyd2.toString().padEnd(6, '0');
    
    
      const ffrequencyN = Number(ffrequencyd);
      if (ffrequencyN > 1300000000) {
        ffrequencyd ="0000100000";
        //const ffrequency = Number(ffrequencyd);
      }
      if (ffrequencyN < 100000) {
        ffrequencyd ="1300000000";
      }
     if (punto === -1) {
        ffrequencyd ="0000100000";
     }
     const ffrequency = Number(ffrequencyd);
     const configJSON = JSON.stringify(ffrequency, null, 2); 
     const rutaffrequency = '/Users/danielMac/ws/workspace/radio02/config/ffrequency.json';
     fs.writeFileSync(rutaffrequency, configJSON, 'utf8', (err) => {
        if (err) {
        console.error('Error al escribir en el archivo:', err);
         return;
       }});
     estaEnRango();
     TuneIn();

    } else {
    let grados = fs.readFileSync(rutagrados, 'utf-8');
    let grados2 = grados * 1; // grados2 son los datos rescatados del archivo
    let datodato2 = datodato * 1; //datodato2 son los grados introducidos por teclado
    let grados1 = datodato2 * 1;
    let constgrad = 100 / 36;





    if (datodato2 > 360 || datodato2 < 0) {
      grados1 = grados2 * 1;
      
    } else {
        grados1 = datodato2;
    }

    const configJSON = JSON.stringify(grados1, null, 2); 
    fs.writeFileSync(rutagrados, configJSON, 'utf8', (err) => {
       if (err) {
       console.error('Error al escribir en el archivo:', err);
        return;
      }});

    if (datodato2 > grados2 ) {
      relay.setState(1, true);
	grados1 = (datodato2  - grados2) * constgrad * 12; //el último múltiplo es la vuelta completa * 12
        console.log(grados1);
      setTimeout(function () {
          relay.setState(1, false);
      }, grados1);
    } else {
      relay.setState(2, true);
	grados1 = (grados2 - datodato2) * constgrad * 12;  //el último múltiplo es la vuelta completa * 12
        console.log(2);
      setTimeout(function () {
          relay.setState(2, false);
      }, grados1);
     }
    }
	
    datosDisplay();
    break; 
  }
}
});
//************************************************************* */
app.get('/bandscope-rows', (req, res) => {
  const since = Number(req.query.since) || 0;
  const newRows = bandscopeRows.filter((r) => r.seq > since);
  const stepHz = bandscopeReadStepHz();
  const lastRow = bandscopeRows[bandscopeRows.length - 1];
  // Con el barrido activo, se informa el ancho de la última fila realmente
  // dibujada (para no desalinear el eje del cliente respecto de lo que se
  // ve). Detenido, se informa lo que se lograría con el Salto/Ancho
  // actuales, para que esos botones se vean reflejados al toque aunque
  // nunca se haya arrancado un barrido (o el último haya sido con otra
  // configuración) — si no, quedaban pegados al valor del último barrido.
  const samples = bandscopeActive && lastRow
    ? lastRow.levels.length
    : bandscopeComputeHalves().reduce((sum, h) => sum + h, 0) * 2;
  const segments = bandscopeActive ? panoramaSegments : bandscopeComputeSegmentCount();
  const centerHz = Number(fs.readFileSync('/Users/danielMac/ws/workspace/radio02/config/ffrequency.json', 'utf-8'));
  res.json({
    rows: newRows,
    lastSeq: bandscopeRowSeq,
    active: bandscopeActive,
    spanKhz: (samples * stepHz) / 2000,
    stepHz,
    samples,
    segments,
    squelch: bandscopeReadSquelch(),
    centerHz,
  });
});
//************************************************************* */
const host = "localhost";
app.listen(port, host, () => {
  console.log(`Servidor escuchando en http://localhost:${port}`);
});



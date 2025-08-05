const express = require('express');
const bodyParser = require('body-parser');
const app = express();
const port = 3000;
const fs = require('fs');
const { SerialPort } = require('serialport');

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


app.use(express.json());

app.post('/enviar-dato', (req, res) => {
  const { dato } = req.body;
  const datoFijo = '(devuelto)';
  const retorno = '\r\n';

//********************* *
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
  res.json({ dato: ffrequencyd +' Mhz'+ ' ' + modulado + ' w:' + wided + ' ts:' + tuningStepd + "&"  + afcc + ' ' + agcc + ' ' + attc + ' ' + nbc  + spaces +  volume + ' >=>  ' + '(' + dato + ')' });
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
  switch (dato) {
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
  default: {
    let punto = dato.indexOf(".");
    let largo = dato.length;
    let resto = largo - punto - 1;
    let ffrequencyd1=dato.slice(0,punto);
    let ffrequencyd2=dato.slice(-resto);
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
    datosDisplay();
    break; 
  }
}
});
//************************************************************* */
const host = "localhost";
app.listen(port, host, () => {
  console.log(`Servidor escuchando en http://localhost:${port}`);
});



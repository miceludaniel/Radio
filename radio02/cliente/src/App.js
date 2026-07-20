import React, {  useEffect, useRef, useState } from 'react';
import axios from 'axios';
import '/Users/danielMac/ws/workspace/radio02/cliente/src/styles.css';
//import imagen from '/Users/danielMac/ws/workspace/radio02/cliente/src/botones/frec_do-1.svg';

// Tamaño de diseño de .app-container (293pt x 519pt, 1pt = 4/3px en CSS)
const DESIGN_WIDTH = 293 * (4 / 3);
const DESIGN_HEIGHT = 519 * (4 / 3);

function getFitScale() {
  // visualViewport refleja el alto real visible en Safari/iOS (descuenta
  // la barra de herramientas); window.innerHeight ahí puede ser más alto.
  const viewportWidth = window.visualViewport?.width ?? window.innerWidth;
  const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
  return Math.min(
    viewportWidth / DESIGN_WIDTH,
    viewportHeight / DESIGN_HEIGHT,
    1
  );
}

function App() {
  const [isRecording, setIsRecording] = useState(false);
  const audioContext = useRef(null);
  const mediaStreamSource = useRef(null);

  useEffect(() => {
    if (isRecording) {
      // Solicitar acceso al micrófono
      navigator.mediaDevices.getUserMedia({ audio: true })
        .then(stream => {
          // Crear un nuevo contexto de audio
          audioContext.current = new (window.AudioContext || window.webkitAudioContext)();

          // Crear una fuente de audio desde el flujo del micrófono
          mediaStreamSource.current = audioContext.current.createMediaStreamSource(stream);

          // Conectar la fuente de audio al destino (parlantes)
          mediaStreamSource.current.connect(audioContext.current.destination);
        })
        .catch(error => {
          console.error('Error al acceder al micrófono', error);
        });
    } else {
      // Detener la grabación
      if (audioContext.current) {
        audioContext.current.close();
      }
    }


  }, [isRecording]);

  const [scale, setScale] = useState(getFitScale);

  useEffect(() => {
    const handleResize = () => setScale(getFitScale());
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);
    window.visualViewport?.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
      window.visualViewport?.removeEventListener('resize', handleResize);
    };
  }, []);

  const [datoRecibido, setDatoRecibido] = useState('');

  const buttons = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];

  const [color, setColor] = useState('white');

  //const [dato, setDato] = useState('');

    const [input1, setInput1] = useState('');
    const [input2, setInput2] = useState('');

  // Cliente en 8443, servidor en 10000 (proxy en package.json)
  const puerto = '/enviar-dato';

  const handleMouseDown = () => {
    setColor(color === 'white' ? '#0255A5' : 'white');
  };

  const handleMouseUp = () => {
    setColor(color === '#0255A5' ? 'white' : '#0255A5');
  };


  const handleSubmit1 = (event) => {
 const dato = 'frec' + input1;
      event.preventDefault();
    axios
    .post(puerto, { dato })
    .then(response => {
      setDatoRecibido(response.data.dato );
    })
    .catch(error => {
      console.error('Error al enviar el dato:', error);
    });
  };
  
  const handleSubmit2 = (event) => {
 const dato = 'grad' + input2;
    event.preventDefault();
  axios
  .post(puerto, { dato })
  .then(response => {
    setDatoRecibido(response.data.dato );
  })
  .catch(error => {
    console.error('Error al enviar el dato:', error);
  });
};

  const enviarDatos = (dato) => {
    axios.post(puerto, { dato })
    .then(response => {
      setDatoRecibido(response.data.dato );
    })
    .catch(error => {
      console.error('Error al enviar el dato:', error);
    });
};

let punto = datoRecibido.indexOf("&");
let largo = datoRecibido.length;
let resto = largo - punto - 1;
let ffrequencyd1=datoRecibido.slice(0,punto);
let ffrequencyd2=datoRecibido.slice(-resto);


  return (

  <div className="app-viewport">
  <div
    className="app-container"
    style={{ transform: `scale(${scale})`, transformOrigin: 'center center' }}
  >

    <div style={{ border: '1px solid #ccc', textAlign: "center", color:'cyan' }}>
           <p>{ffrequencyd1}</p>
           <p>{ffrequencyd2}</p>
    </div>

    <div className="col-md-5" key={buttons}>

      <button key={1} className={"button4"} style={{ color }} onMouseDown={handleMouseDown} onMouseUp={handleMouseUp}  onClick={() => enviarDatos('nullfreq_do-1')}>
       Frecuencia -
      </button>
      
      <button key={2} className={"button4"} style={{ color }} onMouseDown={handleMouseDown} onMouseUp={handleMouseUp}  onClick={() => enviarDatos('nullfreq_up-1')}>
       Frecuencia +
      </button>
      
      <button key={3} className={"button4"} style={{ color }} onMouseDown={handleMouseDown} onMouseUp={handleMouseUp} onClick={() => enviarDatos('nullAFC-1')}>
       AFC
      </button>

      <button key={4} className={"button4"} style={{ color }} onMouseDown={handleMouseDown} onMouseUp={handleMouseUp} onClick={() => enviarDatos('nullancho_do-1')}>
       Ancho -
      </button>

      <button key={5} className={"button4"} style={{ color }} onMouseDown={handleMouseDown} onMouseUp={handleMouseUp} onClick={() => {enviarDatos('nullancho_up-1')}}>
       Ancho +
      </button>

      <button key={6} className={"button4"} style={{ color }} onMouseDown={handleMouseDown} onMouseUp={handleMouseUp} onClick={() => {enviarDatos('nullAGC-1')}}>
       AGC
      </button>

      <button key={7} className={"button4"} style={{ color }} onMouseDown={handleMouseDown} onMouseUp={handleMouseUp} onClick={() => {enviarDatos('nullstep_do-1')}}>
       Salto -
      </button>

      <button key={8} className={"button4"} style={{ color }} onMouseDown={handleMouseDown} onMouseUp={handleMouseUp} onClick={() => {enviarDatos('nullstep_up-1')}}>
       Salto +
      </button>

      <button key={9} className={"button4"} style={{ color }} onMouseDown={handleMouseDown} onMouseUp={handleMouseUp} onClick={() => {enviarDatos('nullATT-1')}}>
       ATT
      </button>

      <button key={10} className={"button4"} style={{ color }} onMouseDown={handleMouseDown} onMouseUp={handleMouseUp} onClick={() => {enviarDatos('nullvolume_do-1')}}>
       Volumen -
      </button>

      <button key={11} className={"button4"} style={{ color }} onMouseDown={handleMouseDown} onMouseUp={handleMouseUp} onClick={() => {enviarDatos('nullvolume_up-1')}}>
      Volumen +
      </button>

      <button key={12} className={"button4"} style={{ color }} onMouseDown={handleMouseDown} onMouseUp={handleMouseUp} onClick={() => enviarDatos('nullNB-1')}>
       NB
      </button>

      <button key={13} className={"button4"} style={{ color }} onMouseDown={handleMouseDown} onMouseUp={handleMouseUp} onClick={() => {enviarDatos('nullmodulacion')}}>
       Modulación
      </button>

      <button key={14} className={"button4"} style={{ color }} onMouseDown={handleMouseDown} onMouseUp={handleMouseUp} onClick={() => {enviarDatos('nullencendido') }}>
       Encendido
      </button>

      <button key={15} className={"button4"} style={{ color }} onMouseDown={handleMouseDown} onMouseUp={handleMouseUp} onClick={() => enviarDatos('nullapagado')}>
       Apagado
      </button>
      
    </div>
    <form> 
     <label>
      <input 
        name = "frecuencia"
        type = "number"
        value = {input1}
        pattern="[0-9]{0,10}"
        onChange = {(e) => setInput1(e.target.value)}
      />
     </label>
     <button type="submit" className={"button1"} onClick={handleSubmit1} >MHz</button>
     <button className={"button1"} onClick={() => setIsRecording(!isRecording)}>
        {isRecording ? 'No audio' : 'audio'}</button>

        <label>
      <input 
        name = 'grados'
        type = "number"
        value = { input2 } 
        pattern="[0-9]{0,10}"
        onChange = {(e) => setInput2(e.target.value)}
      />
     </label>
     <button type="submit" className={"button1"} onClick={handleSubmit2} >Grados</button>
    </form>
  </div>
  </div>
  );
  
}


export default App;

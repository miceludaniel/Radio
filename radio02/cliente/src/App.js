import React, {  useEffect, useRef, useState } from 'react';
import axios from 'axios';
import '/Users/danielMac/ws/workspace/radio02/cliente/src/styles.css';
//import imagen from '/Users/danielMac/ws/workspace/radio02/cliente/src/botones/frec_do-1.svg';

// Tamaño de diseño de .app-container (293pt x 519pt, 1pt = 4/3px en CSS)
const DESIGN_WIDTH = 293 * (4 / 3);
const DESIGN_HEIGHT = 519 * (4 / 3);

// Una reducción grande de altura (>150px) es el teclado abriéndose; una
// reducción chica es la barra de herramientas de Safari mostrándose u
// ocultándose (eso sí debe seguir reescalando el diseño como antes).
const KEYBOARD_HEIGHT_DELTA = 150;

function getViewportBox() {
  // visualViewport refleja el área realmente visible en Safari/iOS: se
  // achica cuando aparece el teclado y además se desplaza (offsetTop/Left)
  // porque Safari intenta llevar el input enfocado por encima del teclado.
  // Si sólo usáramos width/height sin el offset, el contenedor quedaría
  // recortado arriba y con un hueco vacío abajo mientras el teclado está
  // abierto.
  const vv = window.visualViewport;
  if (vv) {
    return { top: vv.offsetTop, left: vv.offsetLeft, width: vv.width, height: vv.height };
  }
  return { top: 0, left: 0, width: window.innerWidth, height: window.innerHeight };
}

function getFitScale(box) {
  return Math.min(box.width / DESIGN_WIDTH, box.height / DESIGN_HEIGHT, 1);
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

  const [viewportBox, setViewportBox] = useState(getViewportBox);
  // Alto "sin teclado" usado para la escala: se actualiza con cambios
  // chicos (barra de Safari) pero se congela ante una caída grande
  // (teclado), para que el diseño no se achique al escribir.
  const baseHeightRef = useRef(viewportBox.height);
  const [keyboardOpen, setKeyboardOpen] = useState(false);

  useEffect(() => {
    const handleViewportChange = () => {
      const box = getViewportBox();
      const drop = baseHeightRef.current - box.height;
      if (drop > KEYBOARD_HEIGHT_DELTA) {
        setKeyboardOpen(true);
      } else {
        baseHeightRef.current = box.height;
        setKeyboardOpen(false);
      }
      setViewportBox(box);
    };
    const handleOrientationChange = () => {
      const box = getViewportBox();
      baseHeightRef.current = box.height;
      setKeyboardOpen(false);
      setViewportBox(box);
    };
    window.addEventListener('resize', handleViewportChange);
    window.addEventListener('orientationchange', handleOrientationChange);
    window.visualViewport?.addEventListener('resize', handleViewportChange);
    window.visualViewport?.addEventListener('scroll', handleViewportChange);
    return () => {
      window.removeEventListener('resize', handleViewportChange);
      window.removeEventListener('orientationchange', handleOrientationChange);
      window.visualViewport?.removeEventListener('resize', handleViewportChange);
      window.visualViewport?.removeEventListener('scroll', handleViewportChange);
    };
  }, []);

  const scale = getFitScale({ width: viewportBox.width, height: baseHeightRef.current });

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

  useEffect(() => {
    // Al cargar la página, mostrar el último estado guardado sin esperar
    // a que se toque un botón.
    enviarDatos('nullestado-1');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

let punto = datoRecibido.indexOf("&");
let largo = datoRecibido.length;
let resto = largo - punto - 1;
let ffrequencyd1=datoRecibido.slice(0,punto);
let ffrequencyd2=datoRecibido.slice(-resto);


  return (

  <div
    className="app-viewport"
    style={{
      position: 'fixed',
      top: viewportBox.top,
      left: viewportBox.left,
      width: viewportBox.width,
      height: viewportBox.height,
      // Con el teclado abierto el diseño (a escala fija) no entra en el
      // alto visible: se ancla abajo para que los campos sigan a la vista
      // y la parte de arriba se recorte, en vez de achicar todo.
      alignItems: keyboardOpen ? 'flex-end' : 'center',
    }}
  >
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

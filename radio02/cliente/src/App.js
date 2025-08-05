import React, {  useEffect, useRef, useState } from 'react';
import axios from 'axios';
import '/Users/danielMac/ws/workspace/radio02/cliente/src/styles.css';
//import imagen from '/Users/danielMac/ws/workspace/radio02/cliente/src/botones/frec_do-1.svg';




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

  const [datoRecibido, setDatoRecibido] = useState('');

  const buttons = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];

  const [color, setColor] = useState('white');

  const [dato, setDato] = useState('');

  //const puerto = 'http://localhost:3000/enviar-dato';
  const puerto = 'http://192.168.1.3:3000/enviar-dato';

  const handleMouseDown = () => {
    setColor(color === 'white' ? '#0255A5' : 'white');
  };

  const handleMouseUp = () => {
    setColor(color === '#0255A5' ? 'white' : '#0255A5');
  };


  const handleSubmit = (event) => {
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

  <div className="app-container">
    
    <div style={{ border: '1px solid #ccc', textAlign: "center", color:'cyan' }}>
           <p>{ffrequencyd1}</p>
           <p>{ffrequencyd2}</p>
    </div>

    <div className="col-md-5" key={buttons}>

      <button key={1} className={"button4"} style={{ color }} onMouseDown={handleMouseDown} onMouseUp={handleMouseUp}  onClick={() => enviarDatos('freq_do-1')}>
       Frecuencia -
      </button>
      
      <button key={2} className={"button4"} style={{ color }} onMouseDown={handleMouseDown} onMouseUp={handleMouseUp}  onClick={() => enviarDatos('freq_up-1')}>
       Frecuencia +
      </button>
      
      <button key={3} className={"button4"} style={{ color }} onMouseDown={handleMouseDown} onMouseUp={handleMouseUp} onClick={() => enviarDatos('AFC-1')}>
       AFC
      </button>

      <button key={4} className={"button4"} style={{ color }} onMouseDown={handleMouseDown} onMouseUp={handleMouseUp} onClick={() => enviarDatos('ancho_do-1')}>
       Ancho -
      </button>

      <button key={5} className={"button4"} style={{ color }} onMouseDown={handleMouseDown} onMouseUp={handleMouseUp} onClick={() => {enviarDatos('ancho_up-1')}}>
       Ancho +
      </button>

      <button key={6} className={"button4"} style={{ color }} onMouseDown={handleMouseDown} onMouseUp={handleMouseUp} onClick={() => {enviarDatos('AGC-1')}}>
       AGC
      </button>

      <button key={7} className={"button4"} style={{ color }} onMouseDown={handleMouseDown} onMouseUp={handleMouseUp} onClick={() => {enviarDatos('step_do-1')}}>
       Salto -
      </button>

      <button key={8} className={"button4"} style={{ color }} onMouseDown={handleMouseDown} onMouseUp={handleMouseUp} onClick={() => {enviarDatos('step_up-1')}}>
       Salto +
      </button>

      <button key={9} className={"button4"} style={{ color }} onMouseDown={handleMouseDown} onMouseUp={handleMouseUp} onClick={() => {enviarDatos('ATT-1')}}>
       ATT
      </button>

      <button key={10} className={"button4"} style={{ color }} onMouseDown={handleMouseDown} onMouseUp={handleMouseUp} onClick={() => {enviarDatos('volume_do-1')}}>
       Volumen -
      </button>

      <button key={11} className={"button4"} style={{ color }} onMouseDown={handleMouseDown} onMouseUp={handleMouseUp} onClick={() => {enviarDatos('volume_up-1')}}>
      Volumen +
      </button>

      <button key={12} className={"button4"} style={{ color }} onMouseDown={handleMouseDown} onMouseUp={handleMouseUp} onClick={() => enviarDatos('NB-1')}>
       NB
      </button>

      <button key={13} className={"button4"} style={{ color }} onMouseDown={handleMouseDown} onMouseUp={handleMouseUp} onClick={() => {enviarDatos('modulacion')}}>
       Modulación
      </button>

      <button key={14} className={"button4"} style={{ color }} onMouseDown={handleMouseDown} onMouseUp={handleMouseUp} onClick={() => {enviarDatos('encendido') }}>
       Encendido
      </button>

      <button key={15} className={"button4"} style={{ color }} onMouseDown={handleMouseDown} onMouseUp={handleMouseUp} onClick={() => enviarDatos('apagado')}>
       Apagado
      </button>
      
    </div>
    <form onSubmit={handleSubmit}>
     <label>
      <input 
        type = "number"
        value = { dato }
        pattern="[0-9]{0,10}"
        onChange = {(e) => setDato(e.target.value)}
      />
     </label>
     <button type="submit" className={"button1"} >MHz</button>
     <button className={"button1"} onClick={() => setIsRecording(!isRecording)}>
        {isRecording ? 'No audio' : 'audio'}</button>
    </form>
  </div>
  );
  
}


export default App;

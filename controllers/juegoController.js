const Juego = require('../models/Juego');
const Carton = require('../models/Carton');

async function verificarGanador(juegoId, cartonEspecifico = null) {
  const juego = await Juego.findById(juegoId);
  if (!juego || juego.estado !== 'jugando') return null;
  
  let cartones;
  if (cartonEspecifico) {
    cartones = await Carton.find({ numeroCarton: cartonEspecifico });
  } else {
    cartones = await Carton.find({ 
      numeroCarton: { $in: juego.cartonesActivos } 
    });
  }
  
  const bolasCantadas = juego.bolasCantadas;
  
  for (const carton of cartones) {
    if (carton.modoMarcado === 'automatico' && !cartonEspecifico) {
      await marcarAutomatico(carton, bolasCantadas);
    }
    
    const completo = verificarModalidad(carton, juego.modalidad);
    
    if (completo) {
      return {
        cartonId: carton.numeroCarton,
        tipo: juego.modalidad
      };
    }
  }
  
  return null;
}

function verificarModalidad(carton, modalidad) {
  const marcadosSet = new Set(carton.marcados);
  const totalNumeros = 24;
  
  switch(modalidad) {
    case 'carton-lleno':
      return marcadosSet.size === 24;
    
    case 'linea':
      for (let i = 0; i < 5; i++) {
        let filaCompleta = true;
        for (let j = 0; j < 5; j++) {
          if (i === 2 && j === 2) continue;
          if (!marcadosSet.has(`${i}-${j}`)) {
            filaCompleta = false;
            break;
          }
        }
        if (filaCompleta) {
          return true;
        }
      }
      return false;
    
    case 'dobles-linea':
      let lineasCompletas = 0;
      for (let i = 0; i < 5; i++) {
        let filaCompleta = true;
        for (let j = 0; j < 5; j++) {
          if (i === 2 && j === 2) continue;
          if (!marcadosSet.has(`${i}-${j}`)) {
            filaCompleta = false;
            break;
          }
        }
        if (filaCompleta) lineasCompletas++;
      }
      return lineasCompletas >= 2;
    
    case 'esquinas':
      const esquinas = ['0-0', '0-4', '4-0', '4-4'];
      const todasMarcadas = esquinas.every(pos => marcadosSet.has(pos));
      
      /*esquinas.forEach(pos => {
        console.log(`  ${pos}: ${marcadosSet.has(pos) ? '✅' : '❌'}`);
      });*/
      
      return todasMarcadas;
    
    case 'forma-x':
      const diagonal1 = ['0-0', '1-1', '3-3', '4-4'];
      const diagonal2 = ['0-4', '1-3', '3-1', '4-0'];
      const todasDiagonales = [...new Set([...diagonal1, ...diagonal2])];
      
      const xCompleta = todasDiagonales.every(pos => marcadosSet.has(pos));
      
      /*todasDiagonales.forEach(pos => {
        console.log(`  ${pos}: ${marcadosSet.has(pos) ? '✅' : '❌'}`);
      });*/
      
      return xCompleta;
    
    default:
      return false;
  }
}

async function marcarAutomatico(carton, bolasCantadas) {
  const nuevasMarcadas = [];
  
  for (let i = 0; i < carton.numeros.length; i++) {
    for (let j = 0; j < carton.numeros[i].length; j++) {
      const numero = carton.numeros[i][j];
      if (numero && bolasCantadas.includes(numero)) {
        const posicion = `${i}-${j}`;
        if (!carton.marcados.includes(posicion)) {
          nuevasMarcadas.push(posicion);
        }
      }
    }
  }
  
  if (nuevasMarcadas.length > 0) {
    carton.marcados = [...carton.marcados, ...nuevasMarcadas];
    await carton.save();
  }
}

module.exports = {
  verificarGanador,
  verificarModalidad
};
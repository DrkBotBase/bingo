const Juego = require('../models/Juego');
const Carton = require('../models/Carton');

// Generar matriz de bingo 5x5 (americana)
function generarMatrizBingo() {
  const matriz = [];
  const rangos = [
    [1, 15],   // B
    [16, 30],  // I
    [31, 45],  // N
    [46, 60],  // G
    [61, 75]   // O
  ];
  
  for (let col = 0; col < 5; col++) {
    const columna = [];
    const numerosColumna = new Set();
    const [min, max] = rangos[col];
    
    while (numerosColumna.size < 5) {
      const num = Math.floor(Math.random() * (max - min + 1)) + min;
      numerosColumna.add(num);
    }
    
    columna.push(...Array.from(numerosColumna));
    
    // Ordenar columna
    columna.sort((a, b) => a - b);
    
    // Agregar a matriz por filas
    for (let fila = 0; fila < 5; fila++) {
      if (!matriz[fila]) matriz[fila] = [];
      matriz[fila][col] = columna[fila];
    }
  }
  
  // Hacer el centro (fila 2, columna 2) null para el logo
  matriz[2][2] = null;
  
  return matriz;
}

// Generar 100 cartones iniciales
async function generarCartonesIniciales() {
  const cartones = [];
  const matricesUsadas = new Set();
  
  for (let i = 1; i <= 100; i++) {
    let matriz;
    let matrizString;
    
    // Generar matriz única
    do {
      matriz = generarMatrizBingo();
      matrizString = JSON.stringify(matriz);
    } while (matricesUsadas.has(matrizString));
    
    matricesUsadas.add(matrizString);
    
    cartones.push({
      numeroCarton: i,
      numeros: matriz,
      marcados: []
    });
  }
  
  return await Carton.insertMany(cartones);
}

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
  console.log(`🔍 Verificando ganador - ${bolasCantadas.length} bolas cantadas`);
  
  for (const carton of cartones) {
    // Saltar cartón 20 si es el que da problemas (debug)
    if (carton.numeroCarton === 20) {
      console.log('🔍 Verificando cartón 20 específicamente');
    }
    
    // Si está en automático, marcar las bolas
    if (carton.modoMarcado === 'automatico' && !cartonEspecifico) {
      await marcarAutomatico(carton, bolasCantadas);
    }
    
    // Verificar según modalidad
    const completo = verificarModalidad(carton, juego.modalidad);
    
    if (completo) {
      console.log(`🎯 Cartón ${carton.numeroCarton} completó ${juego.modalidad}`);
      return {
        cartonId: carton.numeroCarton,
        tipo: juego.modalidad
      };
    }
  }
  
  return null;
}

// controllers/juegoController.js - Función verificarModalidad mejorada
function verificarModalidad(carton, modalidad) {
  const marcadosSet = new Set(carton.marcados);
  const totalNumeros = 24; // 25 - 1 (centro vacío)
  
  console.log(`🔍 Verificando modalidad: ${modalidad} para cartón ${carton.numeroCarton}`);
  console.log('📊 Marcados:', Array.from(marcadosSet));
  
  switch(modalidad) {
    case 'carton-lleno':
      return marcadosSet.size === 24;
    
    case 'linea':
      for (let i = 0; i < 5; i++) {
        let filaCompleta = true;
        for (let j = 0; j < 5; j++) {
          if (i === 2 && j === 2) continue; // Saltar centro
          if (!marcadosSet.has(`${i}-${j}`)) {
            filaCompleta = false;
            break;
          }
        }
        if (filaCompleta) {
          console.log(`✅ Línea completa en fila ${i}`);
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
      console.log(`📊 Líneas completas: ${lineasCompletas}`);
      return lineasCompletas >= 2;
    
    case 'esquinas':
      // Las esquinas son: (0,0), (0,4), (4,0), (4,4)
      const esquinas = ['0-0', '0-4', '4-0', '4-4'];
      const todasMarcadas = esquinas.every(pos => marcadosSet.has(pos));
      
      console.log('🔍 Verificando esquinas:');
      esquinas.forEach(pos => {
        console.log(`  ${pos}: ${marcadosSet.has(pos) ? '✅' : '❌'}`);
      });
      
      return todasMarcadas;
    
    case 'forma-x':
      // Diagonal principal sin centro: (0,0), (1,1), (3,3), (4,4)
      // Diagonal secundaria sin centro: (0,4), (1,3), (3,1), (4,0)
      const diagonal1 = ['0-0', '1-1', '3-3', '4-4'];
      const diagonal2 = ['0-4', '1-3', '3-1', '4-0'];
      const todasDiagonales = [...new Set([...diagonal1, ...diagonal2])];
      
      const xCompleta = todasDiagonales.every(pos => marcadosSet.has(pos));
      
      console.log('🔍 Verificando forma X:');
      todasDiagonales.forEach(pos => {
        console.log(`  ${pos}: ${marcadosSet.has(pos) ? '✅' : '❌'}`);
      });
      
      return xCompleta;
    
    default:
      return false;
  }
}

// Marcar números automáticamente
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
  generarMatrizBingo,
  generarCartonesIniciales,
  verificarGanador,
  verificarModalidad
};
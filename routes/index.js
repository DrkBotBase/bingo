const express = require('express');
const router = express.Router();
const Juego = require('../models/Juego');

// Landing page
router.get('/', async (req, res) => {
  const juego = await Juego.findOne().sort({ createdAt: -1 });
  res.render('landing', { 
    titulo: 'Bingo Amigos',
    juego: juego || { estado: 'esperando' }
  });
});

// Service Worker
router.get('/service-worker.js', (req, res) => {
  res.sendFile(path.join(__dirname, '../service-worker.js'));
});

// Manifest
router.get('/manifest.json', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/manifest.json'));
});

// API: Obtener estado del juego
router.get('/api/juego/estado', async (req, res) => {
    try {
        const juego = await Juego.findOne().sort({ createdAt: -1 });
        res.json({ 
            juego: juego || { estado: 'esperando', bolasCantadas: [] }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// API: Sincronización múltiple
router.post('/api/jugador/sync-multi', async (req, res) => {
    try {
        const { codigo, marcados, modo } = req.body;
        
        // Actualizar cada cartón
        for (const [cartonId, marcadosArray] of Object.entries(marcados)) {
            await Carton.findOneAndUpdate(
                { numeroCarton: parseInt(cartonId) },
                { 
                    marcados: marcadosArray,
                    modoMarcado: modo,
                    ultimaConexion: new Date()
                }
            );
        }
        
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
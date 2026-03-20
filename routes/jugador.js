const express = require('express');
const router = express.Router();
const Carton = require('../models/Carton');
const Juego = require('../models/Juego');
const Usuario = require('../models/Usuario');

router.get('/login', (req, res) => {
    res.render('jugador/login');
});

router.get('/mis-cartones', (req, res) => {
    res.render('jugador/mis-cartones');
});

router.get('/carton/:numero', async (req, res) => {
    try {
        const numeroCarton = parseInt(req.params.numero);
        const codigo = req.query.codigo;
        
        if (!codigo) {
            return res.redirect('/jugador/login');
        }
        
        const usuario = await Usuario.findOne({ 
            codigoAcceso: codigo.toUpperCase(),
            cartonesAsignados: numeroCarton,
            activo: true
        });
        
        if (!usuario) {
            return res.status(403).render('error', { 
                mensaje: 'No tienes acceso a este cartón' 
            });
        }
        
        let carton = await Carton.findOne({ numeroCarton });
        
        if (!carton) {
            return res.status(404).render('error', { 
                mensaje: 'Cartón no encontrado' 
            });
        }
        
        const juego = await Juego.findOne().sort({ createdAt: -1 });
        
        res.render('jugador/carton', {
            carton,
            juego: juego || { estado: 'esperando', bolasCantadas: [] },
            usuario: { codigo: usuario.codigoAcceso }
        });
        
    } catch (error) {
        console.error('Error cargando cartón:', error);
        res.status(500).render('error', { 
            mensaje: 'Error cargando el cartón' 
        });
    }
});

router.post('/api/:numero/sync', async (req, res) => {
    try {
        const numeroCarton = parseInt(req.params.numero);
        const { marcados, modo, codigo } = req.body;
        
        if (codigo) {
            const usuario = await Usuario.findOne({ 
                codigoAcceso: codigo.toUpperCase(),
                cartonesAsignados: numeroCarton
            });
            
            if (!usuario) {
                return res.status(403).json({ error: 'No autorizado' });
            }
        }
        
        const carton = await Carton.findOne({ numeroCarton });
        if (!carton) {
            return res.status(404).json({ error: 'Cartón no encontrado' });
        }
        
        carton.marcados = marcados || [];
        if (modo) carton.modoMarcado = modo;
        carton.ultimaConexion = new Date();
        
        await carton.save();
        
        res.json({ success: true, marcados: carton.marcados.length });
        
    } catch (error) {
        console.error('Error en sync:', error);
        res.status(500).json({ error: error.message });
    }
});

router.get('/multi', (req, res) => {
    res.render('jugador/multi-carton');
});

module.exports = router;
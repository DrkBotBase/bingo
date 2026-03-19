const express = require('express');
const router = express.Router();
const Juego = require('../models/Juego');
const Carton = require('../models/Carton');
const Usuario = require('../models/Usuario');

// Middleware de autenticación
const requireAdmin = (req, res, next) => {
  if (req.session.admin) {
    next();
  } else {
    res.redirect('/admin/login');
  }
};

// Login page
router.get('/login', (req, res) => {
  if (req.session.admin) {
    return res.redirect('/admin/dashboard');
  }
  res.render('admin/login', { error: null });
});

// Login POST
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  
  // Validar credenciales (mejor usar DB en producción)
  if (username === process.env.ADMIN_USERNAME && 
      password === process.env.ADMIN_PASSWORD) {
    req.session.admin = true;
    res.redirect('/admin/dashboard');
  } else {
    res.render('admin/login', { error: 'Credenciales incorrectas' });
  }
});

// Logout
router.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/admin/login');
});

// Dashboard - CORREGIDO: Ahora pasa cartones a la vista
router.get('/dashboard', requireAdmin, async (req, res) => {
  try {
    const juego = await Juego.findOne().sort({ createdAt: -1 });
    
    // Obtener cartones activos (con socketId) y algunos más para mostrar
    const cartonesActivos = await Carton.countDocuments({ socketId: { $ne: null } });
    const totalCartones = await Carton.countDocuments();
    
    // Obtener los últimos 10 cartones para mostrar en la tabla
    const cartones = await Carton.find()
      .sort({ ultimaConexion: -1 })
      .limit(10)
      .lean(); // .lean() para mejor performance
    
    console.log(`📊 Dashboard: ${cartones.length} cartones cargados`); // Debug
    
    res.render('admin/dashboard', {
      juego: juego || { estado: 'esperando', bolasCantadas: [] },
      estadisticas: {
        cartonesActivos,
        totalCartones,
        bolasCantadas: juego?.bolasCantadas?.length || 0
      },
      cartones: cartones || [] // Asegurar que siempre sea un array
    });
  } catch (error) {
    console.error('Error en dashboard:', error);
    res.status(500).render('error', { 
      mensaje: 'Error cargando el dashboard' 
    });
  }
});

// Panel de control
router.get('/control', requireAdmin, async (req, res) => {
  try {
    const juego = await Juego.findOne().sort({ createdAt: -1 });
    const cartones = await Carton.find().limit(10).lean();
    
    res.render('admin/control', {
      juego: juego || { estado: 'esperando', bolasCantadas: [] },
      cartones: cartones || []
    });
  } catch (error) {
    console.error('Error en control:', error);
    res.status(500).render('error', { 
      mensaje: 'Error cargando el panel de control' 
    });
  }
});

// API: Resetear juego
router.post('/api/reset', requireAdmin, async (req, res) => {
  try {
    await Juego.updateMany({ estado: 'jugando' }, { estado: 'finalizado' });
    
    const nuevoJuego = new Juego({
      estado: 'esperando',
      bolasCantadas: []
    });
    await nuevoJuego.save();
    
    // Resetear marcados de cartones
    await Carton.updateMany({}, { marcados: [] });
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
// API: Estadísticas
router.get('/api/stats', requireAdmin, async (req, res) => {
    try {
        const juego = await Juego.findOne({ estado: 'jugando' });
        const cartonesConectados = await Carton.find({ socketId: { $ne: null } })
            .select('numeroCarton')
            .lean();
        
        // Obtener lista de IDs de cartones conectados
        const conectadosList = cartonesConectados.map(c => c.numeroCarton);
        
        // Obtener progreso de cartones
        const cartones = await Carton.find({ socketId: { $ne: null } }).lean();
        let progresoTotal = 0;
        cartones.forEach(c => {
            progresoTotal += (c.marcados?.length || 0);
        });
        const progresoPromedio = cartones.length > 0 ? 
            Math.round((progresoTotal / (cartones.length * 25)) * 100) : 0;
        
        res.json({
            juego,
            cartonesConectados: cartonesConectados.length,
            cartonesConectadosList: conectadosList,
            progresoPromedio,
            timestamp: new Date()
        });
    } catch (error) {
        console.error('Error en API stats:', error);
        res.status(500).json({ error: error.message });
    }
});
// Ver todos los cartones

router.get('/cartones', requireAdmin, async (req, res) => {
    try {
        // Buscar el juego más reciente
        const juego = await Juego.findOne().sort({ createdAt: -1 });
        
        // Si no hay juego, crear uno por defecto
        if (!juego) {
            const nuevoJuego = new Juego({
                estado: 'esperando',
                cartonesActivos: [],
                cartonesDisponibles: Array.from({ length: 100 }, (_, i) => i + 1)
            });
            await nuevoJuego.save();
            
            // Obtener cartones con jugadores conectados (vacío por ahora)
            const cartonesConectados = await Carton.find({ socketId: { $ne: null } })
                .select('numeroCarton')
                .lean();
            
            const conectadosList = cartonesConectados.map(c => c.numeroCarton);
            
            return res.render('admin/cartones', {
                juego: nuevoJuego,
                cartonesConectados: conectadosList
            });
        }
        
        // Obtener cartones con jugadores conectados
        const cartonesConectados = await Carton.find({ socketId: { $ne: null } })
            .select('numeroCarton')
            .lean();
        
        const conectadosList = cartonesConectados.map(c => c.numeroCarton);
        
        console.log('✅ Cargando gestión de cartones:', {
            juegoEstado: juego.estado,
            activos: juego.cartonesActivos ? juego.cartonesActivos.length : 0,
            conectados: conectadosList.length
        });
        
        res.render('admin/cartones', {
            juego: juego,
            cartonesConectados: conectadosList
        });
    } catch (error) {
        console.error('❌ Error en gestión de cartones:', error);
        res.status(500).render('error', { mensaje: 'Error cargando cartones: ' + error.message });
    }
});
// API: Activar cartones específicos
router.post('/api/cartones/activar', requireAdmin, async (req, res) => {
    try {
        const { cartones } = req.body;
        
        if (!Array.isArray(cartones)) {
            return res.status(400).json({ success: false, error: 'Formato inválido' });
        }
        
        // Validar que sean números del 1 al 100
        const validos = cartones.filter(c => c >= 1 && c <= 100);
        
        // Actualizar el juego con los cartones activos
        let juego = await Juego.findOne().sort({ createdAt: -1 });
        
        if (!juego) {
            juego = new Juego({
                estado: 'esperando',
                cartonesActivos: validos,
                cartonesDisponibles: Array.from({ length: 100 }, (_, i) => i + 1)
            });
        } else {
            juego.cartonesActivos = validos;
        }
        
        await juego.save();
        
        // Notificar a los jugadores sobre cambios (opcional)
        // io.emit('cartones-actualizados', { activos: validos });
        
        res.json({ 
            success: true, 
            message: `${validos.length} cartones activados`,
            cartones: validos 
        });
    } catch (error) {
        console.error('Error activando cartones:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// API: Obtener estado actual de cartones
router.get('/api/cartones/estado', requireAdmin, async (req, res) => {
    try {
        const juego = await Juego.findOne().sort({ createdAt: -1 });
        const cartonesConectados = await Carton.find({ socketId: { $ne: null } })
            .select('numeroCarton')
            .lean();
        
        res.json({
            activos: juego ? juego.cartonesActivos : [],
            conectados: cartonesConectados.map(c => c.numeroCarton),
            total: 100
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// API: Resetear configuración de cartones
router.post('/api/cartones/reset', requireAdmin, async (req, res) => {
    try {
        const juego = await Juego.findOne().sort({ createdAt: -1 });
        
        if (juego) {
            juego.cartonesActivos = [];
            await juego.save();
        }
        
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Gestión de usuarios
router.get('/usuarios', requireAdmin, async (req, res) => {
    try {
        console.log('📋 Cargando gestión de usuarios...');
        
        // Verificar que el modelo Usuario está disponible
        if (!Usuario) {
            throw new Error('Modelo Usuario no encontrado');
        }
        
        // Obtener todos los usuarios activos
        const usuarios = await Usuario.find({ activo: true })
            .sort({ createdAt: -1 })
            .lean();
        
        console.log(`✅ ${usuarios.length} usuarios encontrados`);
        
        // Obtener todos los cartones para el selector
        const cartones = await Carton.find()
            .select('numeroCarton')
            .lean();
        
        // Obtener juego actual
        const juego = await Juego.findOne().sort({ createdAt: -1 });
        
        res.render('admin/usuarios', {
            usuarios: usuarios,
            cartones: cartones.map(c => c.numeroCarton),
            juego: juego || { estado: 'esperando' }
        });
        
    } catch (error) {
        console.error('❌ Error cargando usuarios:', error);
        res.status(500).render('error', { 
            mensaje: 'Error cargando usuarios: ' + error.message 
        });
    }
});

// API: Crear/Actualizar usuario
router.post('/api/usuarios', requireAdmin, async (req, res) => {
    try {
        const { codigo, nombre, cartones } = req.body;
        
        if (!codigo) {
            return res.status(400).json({ 
                success: false, 
                error: 'El código es requerido' 
            });
        }
        
        // Validar cantidad de cartones
        if (cartones && cartones.length > 4) {
            return res.status(400).json({ 
                success: false, 
                error: 'Máximo 4 cartones por usuario' 
            });
        }
        
        // Buscar si el usuario ya existe
        let usuario = await Usuario.findOne({ 
            codigoAcceso: codigo.toUpperCase() 
        });
        
        if (usuario) {
            // Actualizar existente
            usuario.nombre = nombre || usuario.nombre;
            if (cartones) {
                usuario.cartonesAsignados = cartones;
            }
            usuario.activo = true;
        } else {
            // Crear nuevo
            usuario = new Usuario({
                codigoAcceso: codigo.toUpperCase(),
                nombre: nombre || 'Jugador',
                cartonesAsignados: cartones || []
            });
        }
        
        await usuario.save();
        
        res.json({ 
            success: true, 
            usuario: usuario,
            message: 'Usuario guardado correctamente'
        });
        
    } catch (error) {
        console.error('Error guardando usuario:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// API: Desactivar usuario
router.post('/api/usuarios/desactivar', requireAdmin, async (req, res) => {
    try {
        const { codigo } = req.body;
        
        const usuario = await Usuario.findOneAndUpdate(
            { codigoAcceso: codigo.toUpperCase() },
            { activo: false },
            { returnDocument: 'after' }
        );
        
        if (!usuario) {
            return res.status(404).json({ 
                success: false, 
                error: 'Usuario no encontrado' 
            });
        }
        
        res.json({ 
            success: true, 
            message: 'Usuario desactivado' 
        });
        
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// API: Obtener usuarios (para refrescar)
router.get('/api/usuarios', requireAdmin, async (req, res) => {
    try {
        const usuarios = await Usuario.find({ activo: true })
            .sort({ createdAt: -1 })
            .lean();
        
        res.json({ 
            success: true, 
            usuarios: usuarios 
        });
        
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

module.exports = router;
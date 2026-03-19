// models/Usuario.js (ya está bien, pero asegurémonos)
const mongoose = require('mongoose');

const usuarioSchema = new mongoose.Schema({
    codigoAcceso: { 
        type: String, 
        required: true, 
        unique: true,
        uppercase: true,
        trim: true
    },
    nombre: { 
        type: String, 
        default: 'Jugador' 
    },
    cartonesAsignados: [{
        type: Number,
        ref: 'BCarton',  // Referencia al modelo Carton
        required: true
    }],
    activo: { 
        type: Boolean, 
        default: true 
    },
    ultimaConexion: { 
        type: Date, 
        default: Date.now 
    },
    socketIds: [String],
    createdAt: { 
        type: Date, 
        default: Date.now 
    }
});

// Límite de 4 cartones por usuario
usuarioSchema.path('cartonesAsignados').validate(function(cartones) {
    return cartones.length <= 4;
}, 'Máximo 4 cartones por usuario');

module.exports = mongoose.model('BUsuario', usuarioSchema);
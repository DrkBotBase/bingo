module.exports = {
  isAuthenticated: (req, res, next) => {
    if (req.session.admin) {
      return next();
    }
    res.redirect('/admin/login');
  },
  
  isPlayer: (req, res, next) => {
    // Los jugadores no necesitan autenticación
    // Pero podemos agregar lógica de rate limiting aquí
    next();
  }
};
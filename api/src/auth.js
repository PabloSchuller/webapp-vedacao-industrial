import jwt from 'jsonwebtoken';
export function autenticacao(req,res,next) {
  try {
    const token = /^Bearer (.+)$/.exec(req.headers.authorization || '')?.[1];
    if (!token) return res.status(401).json({erro:'Token obrigatório.'});
    req.usuario = jwt.verify(token, process.env.JWT_SECRET, {algorithms:['HS256']});
    next();
  } catch { res.status(401).json({erro:'Token inválido ou expirado.'}); }
}
export function somenteDono(req,res,next) {
  if(req.usuario?.papel !== 'DONO') return res.status(403).json({erro:'Apenas o responsável pode realizar esta ação.'});
  next();
}

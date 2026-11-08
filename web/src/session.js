// Apenas temporizador de UX. A assinatura e a autorização são verificadas pela API.
export function expiresAt(token){
  try{const payload=JSON.parse(atob(token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));return Number.isFinite(payload.exp)?payload.exp*1000:0;}catch{return 0;}
}
export function canManagePhoto(user,authorId){return Boolean(user?.id)&&(user.papel==='DONO'||user.id===authorId);}

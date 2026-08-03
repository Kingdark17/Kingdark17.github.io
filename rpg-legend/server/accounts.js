const crypto=require('crypto');
const {Pool}=require('pg');

const pool=process.env.DATABASE_URL?new Pool({connectionString:process.env.DATABASE_URL,ssl:process.env.DATABASE_SSL==='false'?false:{rejectUnauthorized:false}}):null;
const allowedOrigin=process.env.ALLOWED_ORIGIN||'*';
const attempts=new Map();

function json(res,status,data){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Access-Control-Allow-Origin':allowedOrigin,'Access-Control-Allow-Headers':'Content-Type, Authorization','Access-Control-Allow-Methods':'GET,POST,PUT,OPTIONS','Cache-Control':'no-store'});res.end(JSON.stringify(data));}
function body(req){return new Promise((resolve,reject)=>{let raw='';req.on('data',chunk=>{raw+=chunk;if(raw.length>700000){reject(new Error('large'));req.destroy();}});req.on('end',()=>{try{resolve(raw?JSON.parse(raw):{});}catch(e){reject(e);}});req.on('error',reject);});}
function hashToken(token){return crypto.createHash('sha256').update(token).digest('hex');}
function passwordHash(password,salt){return new Promise((resolve,reject)=>crypto.scrypt(password,salt,64,(err,key)=>err?reject(err):resolve(key.toString('hex'))));}
function safeUser(row){return {id:row.id,username:row.username,createdAt:row.created_at};}
function limited(req){const key=req.socket.remoteAddress||'unknown',now=Date.now(),entry=attempts.get(key)||{since:now,count:0};if(now-entry.since>60000){entry.since=now;entry.count=0;}entry.count++;attempts.set(key,entry);return entry.count>12;}
async function init(){if(!pool){console.warn('Contas desativadas: configure DATABASE_URL.');return;}await pool.query(`
 CREATE TABLE IF NOT EXISTS users(id BIGSERIAL PRIMARY KEY,username VARCHAR(24) UNIQUE NOT NULL,password_hash TEXT NOT NULL,password_salt TEXT NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
 CREATE TABLE IF NOT EXISTS sessions(token_hash CHAR(64) PRIMARY KEY,user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,expires_at TIMESTAMPTZ NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
 CREATE TABLE IF NOT EXISTS cloud_saves(user_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,data JSONB NOT NULL,updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
 CREATE UNIQUE INDEX IF NOT EXISTS users_username_lower_idx ON users(LOWER(username));
 CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions(user_id);
 `);await pool.query('DELETE FROM sessions WHERE expires_at<NOW()');console.log('Sistema de contas conectado ao banco de dados.');}
async function session(req){if(!pool)return null;const auth=String(req.headers.authorization||''),token=auth.startsWith('Bearer ')?auth.slice(7):'';if(token.length<32)return null;const result=await pool.query('SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>NOW()',[hashToken(token)]);return result.rows[0]||null;}
function validSave(data){return !!(data&&typeof data==='object'&&data.hero&&typeof data.hero.name==='string'&&data.hero.attrs&&data.hero.equip&&Array.isArray(data.inventory)&&Array.isArray(data.party)&&Number(data.floor)>=1&&Number(data.floor)<=10000);}

async function handle(req,res,url){
 if(!url.pathname.startsWith('/api/'))return false;
 if(req.method==='OPTIONS'){json(res,204,{});return true;}
 if(url.pathname==='/api/account/status'){json(res,200,{online:!!pool});return true;}
 if(!pool){json(res,503,{error:'O banco de dados de contas ainda não foi configurado.'});return true;}
 try{
  if(url.pathname==='/api/account/register'&&req.method==='POST'){
   if(limited(req)){json(res,429,{error:'Muitas tentativas. Aguarde um minuto.'});return true;}
   const data=await body(req),username=String(data.username||'').trim();const password=String(data.password||'');
   if(!/^[A-Za-z0-9_]{3,24}$/.test(username)){json(res,400,{error:'Use de 3 a 24 letras, números ou _ no nome.'});return true;}
   if(password.length<8||password.length>128){json(res,400,{error:'A senha precisa ter entre 8 e 128 caracteres.'});return true;}
   const salt=crypto.randomBytes(16).toString('hex'),hash=await passwordHash(password,salt);let result;
   try{result=await pool.query('INSERT INTO users(username,password_hash,password_salt) VALUES($1,$2,$3) RETURNING *',[username,hash,salt]);}catch(e){if(e.code==='23505'){json(res,409,{error:'Esse nome de usuário já está sendo usado.'});return true;}throw e;}
   const token=crypto.randomBytes(32).toString('hex');await pool.query("INSERT INTO sessions(token_hash,user_id,expires_at) VALUES($1,$2,NOW()+INTERVAL '30 days')",[hashToken(token),result.rows[0].id]);json(res,201,{token,user:safeUser(result.rows[0])});return true;
  }
  if(url.pathname==='/api/account/login'&&req.method==='POST'){
   if(limited(req)){json(res,429,{error:'Muitas tentativas. Aguarde um minuto.'});return true;}
   const data=await body(req),username=String(data.username||'').trim(),password=String(data.password||'');const result=await pool.query('SELECT * FROM users WHERE LOWER(username)=LOWER($1)',[username]);const user=result.rows[0];
   if(!user||!crypto.timingSafeEqual(Buffer.from(await passwordHash(password,user.password_salt),'hex'),Buffer.from(user.password_hash,'hex'))){json(res,401,{error:'Usuário ou senha incorretos.'});return true;}
   const token=crypto.randomBytes(32).toString('hex');await pool.query("INSERT INTO sessions(token_hash,user_id,expires_at) VALUES($1,$2,NOW()+INTERVAL '30 days')",[hashToken(token),user.id]);json(res,200,{token,user:safeUser(user)});return true;
  }
  const user=await session(req);if(!user){json(res,401,{error:'Entre novamente na sua conta.'});return true;}
  if(url.pathname==='/api/account/me'&&req.method==='GET'){json(res,200,{user:safeUser(user)});return true;}
  if(url.pathname==='/api/account/logout'&&req.method==='POST'){await pool.query('DELETE FROM sessions WHERE token_hash=$1',[hashToken(String(req.headers.authorization||'').slice(7))]);json(res,200,{ok:true});return true;}
  if(url.pathname==='/api/save'&&req.method==='GET'){const result=await pool.query('SELECT data,updated_at FROM cloud_saves WHERE user_id=$1',[user.id]);json(res,200,result.rows[0]?{save:result.rows[0].data,updatedAt:result.rows[0].updated_at}:{save:null});return true;}
  if(url.pathname==='/api/save'&&req.method==='PUT'){const data=await body(req);if(!validSave(data.save)){json(res,400,{error:'Progresso inválido.'});return true;}await pool.query('INSERT INTO cloud_saves(user_id,data,updated_at) VALUES($1,$2,NOW()) ON CONFLICT(user_id) DO UPDATE SET data=EXCLUDED.data,updated_at=NOW()',[user.id,JSON.stringify(data.save)]);json(res,200,{ok:true});return true;}
  json(res,404,{error:'Rota não encontrada.'});return true;
 }catch(e){console.error('Erro de conta:',e);if(!res.headersSent)json(res,500,{error:'Erro interno no sistema de contas.'});return true;}
}
module.exports={init,handle};

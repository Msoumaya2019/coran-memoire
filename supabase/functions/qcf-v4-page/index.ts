// Quran Foundation credentials remain in Supabase Edge Function secrets.
// This endpoint serves one page at a time to authenticated app users.
const jsonHeaders={"content-type":"application/json; charset=utf-8","cache-control":"private, max-age=3600"};
let tokenCache:{value:string;expires:number}|null=null;

function response(body:unknown,status=200){return new Response(JSON.stringify(body),{status,headers:jsonHeaders});}

async function accessToken(id:string,secret:string){
  if(tokenCache&&Date.now()<tokenCache.expires)return tokenCache.value;
  const result=await fetch('https://oauth2.quran.foundation/oauth2/token',{
    method:'POST',headers:{authorization:`Basic ${btoa(`${id}:${secret}`)}`,'content-type':'application/x-www-form-urlencoded'},
    body:'grant_type=client_credentials&scope=content',
  });
  if(!result.ok)throw new Error(`QF token ${result.status}`);
  const data=await result.json();
  if(typeof data.access_token!=='string')throw new Error('QF token missing');
  tokenCache={value:data.access_token,expires:Date.now()+Math.max(60,Number(data.expires_in??3600)-120)*1000};
  return tokenCache.value;
}

Deno.serve(async request=>{
  if(request.method!=='GET')return response({error:'Méthode invalide.'},405);
  const url=new URL(request.url),page=Number(url.searchParams.get('page'));
  if(!Number.isInteger(page)||page<1||page>604)return response({error:'Page invalide.'},400);
  const supabaseUrl=Deno.env.get('SUPABASE_URL'),anonKey=Deno.env.get('SUPABASE_ANON_KEY');
  const bearer=request.headers.get('authorization');
  if(!supabaseUrl||!anonKey||!bearer?.startsWith('Bearer '))return response({error:'Connexion requise.'},401);
  const user=await fetch(`${supabaseUrl}/auth/v1/user`,{headers:{authorization:bearer,apikey:anonKey}});
  if(!user.ok)return response({error:'Session expirée.'},401);
  const clientId=Deno.env.get('QF_PRODUCTION_CLIENT_ID'),clientSecret=Deno.env.get('QF_PRODUCTION_CLIENT_SECRET');
  if(!clientId||!clientSecret)return response({error:'Moushaf indisponible.'},503);
  try{
    for(let attempt=0;attempt<2;attempt++){
      const token=await accessToken(clientId,clientSecret);
      const endpoint=`https://apis.quran.foundation/content/api/v4/verses/by_page/${page}?mushaf=19&words=true&word_fields=code_v2,text_qpc_hafs&per_page=50`;
      const upstream=await fetch(endpoint,{headers:{'x-auth-token':token,'x-client-id':clientId}});
      if(upstream.status===401&&attempt===0){tokenCache=null;continue;}
      if(!upstream.ok)return response({error:'Page Tajweed indisponible.'},502);
      const data=await upstream.json();
      if(data.pagination?.total_pages!==1||!Array.isArray(data.verses)||!data.verses.length)return response({error:'Page Tajweed incomplète.'},502);
      return response({verses:data.verses.map((verse:Record<string,unknown>)=>({
        verse_key:verse.verse_key,
        words:Array.isArray(verse.words)?verse.words.map((word:Record<string,unknown>)=>({
          position:word.position,page_number:word.page_number,line_number:word.line_number,
          char_type_name:word.char_type_name,code_v2:word.code_v2,text_qpc_hafs:word.text_qpc_hafs,
        })):[],
      })),pagination:{total_pages:1}});
    }
    return response({error:'Authentification Tajweed indisponible.'},502);
  }catch{return response({error:'Page Tajweed indisponible.'},502);}
});

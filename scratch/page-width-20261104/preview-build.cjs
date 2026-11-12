// Local RN Web rendering of the real screens. Native services are inert; no API requests.
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const esbuild = require('C:/Capstone_Project_Web/node_modules/esbuild');
const root = process.cwd();
const nm = path.join(root, 'node_modules');
const palette = JSON.stringify(path.join(root, 'src/config/palette.ts'));
const mocks = {
  'react-native-safe-area-context': `import React from 'react';import {View,useWindowDimensions} from 'react-native';export const SafeAreaView=({children,edges,...p})=><View {...p}>{children}</View>;export const SafeAreaProvider=({children})=><>{children}</>;export const useSafeAreaInsets=()=>({top:24,bottom:16,left:0,right:0});export const useSafeAreaFrame=()=>useWindowDimensions();`,
  'react-native-keyboard-controller': `export {ScrollView as KeyboardAwareScrollView,View as KeyboardStickyView,View as KeyboardProvider} from 'react-native';`,
  '@react-native-async-storage/async-storage': `export default {getItem:async()=>null,setItem:async()=>{},removeItem:async()=>{}};`,
  '@react-navigation/native': `export const useNavigation=()=>({isFocused:()=>true,addListener:()=>()=>{},navigate(){}});`,
  'expo-linear-gradient': `import React from 'react';import {View} from 'react-native';export const LinearGradient=({colors,start,end,style,...p})=><View {...p} style={[style,{backgroundImage:'linear-gradient(120deg,'+colors.join(',')+')'}]}/>;`,
  'expo-image': `import React from 'react';import {Image as RNImage} from 'react-native';export const Image=({contentFit,autoplay,cachePolicy,transition,...p})=><RNImage {...p} resizeMode={contentFit==='contain'?'contain':'cover'}/>;`,
  'useThemeColor': `import {MobileLight,MobileDark} from ${palette};export function useThemeColor(){const isDark=new URLSearchParams(location.search).get('theme')==='dark';return {colors:isDark?MobileDark:MobileLight,isDark,setThemeMode(){}};}`,
  'AuthContext': `export const useAuth=()=>({user:null,login:async()=>{},logout:async()=>{}});`,
  'apiClient': `export const apiClient={get:async()=>({data:[]}),post:async()=>({data:{}})};`,
  'googleAuth': `export const signInWithGoogleNative=async()=>null;`,
  'mfaTrust': `export const mfaTrustField=async()=>({});export const readLoginChallenge=()=>null;export const saveMfaTrustToken=async()=>{};`,
};
async function build(variant) {
  await esbuild.build({
    entryPoints: [path.join(__dirname,'preview-entry.jsx')], bundle:true, outfile:path.join(__dirname,`${variant}.js`), platform:'browser',format:'iife',jsx:'automatic',
    define:{'process.env.NODE_ENV':'"development"',__DEV__:'true'},
    resolveExtensions:['.web.tsx','.web.ts','.tsx','.ts','.web.js','.js','.jsx','.json'],
    loader:{'.png':'dataurl','.webp':'dataurl'},
    alias:{'react-native':path.join(nm,'react-native-web/dist/index.js'),'react-native-svg':path.join(nm,'react-native-svg/lib/module/ReactNativeSVG.web.js')},
    plugins:[{name:'local-preview',setup(b){
      b.onResolve({filter:/.*/},args=>{
        const key=Object.keys(mocks).find(k=>args.path===k||args.path.endsWith('/'+k));
        if(key)return {path:key,namespace:'preview-mock'};
      });
      b.onLoad({filter:/.*/,namespace:'preview-mock'},args=>({contents:mocks[args.path],loader:'tsx',resolveDir:root}));
      if(variant==='before') b.onLoad({filter:/src[\\/].*\.tsx?$/},args=>{
        const saved=path.join(__dirname,'before',path.relative(root,args.path)+'.txt');
        if(fs.existsSync(saved)) return {contents:fs.readFileSync(saved,'utf8'),loader:args.path.endsWith('.tsx')?'tsx':'ts',resolveDir:path.dirname(args.path)};
      });
    }}],
  });
}
(async()=>{
  await build('before');await build('after');
  http.createServer((req,res)=>{
    const pathname=new URL(req.url,'http://localhost').pathname;
    if(pathname==='/before.js'||pathname==='/after.js'){res.setHeader('Content-Type','application/javascript');res.end(fs.readFileSync(path.join(__dirname,pathname.slice(1))));return;}
    if(pathname.startsWith('/fonts/')){const file=path.join(nm,'@expo-google-fonts/urbanist',pathname.slice(7));if(fs.existsSync(file)){res.setHeader('Content-Type','font/ttf');res.end(fs.readFileSync(file));return;}}
    const variant=new URL(req.url,'http://localhost').searchParams.get('variant')==='before'?'before':'after';
    const fonts=[['regular','400Regular',400],['medium','500Medium',500],['semibold','600SemiBold',600],['bold','700Bold',700]].map(([,dir,weight])=>`@font-face{font-family:Urbanist_${dir};src:url('/fonts/${dir}/Urbanist_${dir}.ttf')} `).join('');
    res.setHeader('Content-Type','text/html');res.end(`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>${fonts}html,body,#root{margin:0;width:100%;height:100%;overflow:hidden}body{font-family:sans-serif}</style></head><body><div id="root"></div><script src="/${variant}.js"></script></body></html>`);
  }).listen(8097,'127.0.0.1',()=>console.log('Local source preview: http://127.0.0.1:8097/?variant=after'));
})().catch(e=>{console.error(e.message);process.exitCode=1});

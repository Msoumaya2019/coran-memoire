const {getDefaultConfig}=require('expo/metro-config');
const config=getDefaultConfig(__dirname);
config.resolver.assetExts=[...new Set([...config.resolver.assetExts,'woff2','wasm'])];
const previous=config.resolver.blockList;
config.resolver.blockList=[...(Array.isArray(previous)?previous:previous?[previous]:[]),/[\\/](?:work-dist|work-dist-ios)[\\/]/,/[\\/]tests[\\/]build[\\/]/];
module.exports=config;

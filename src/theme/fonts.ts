import {useFonts} from 'expo-font';
let loaded=false;
export const fontAssets={
 'Cormorant-Semibold':require('@expo-google-fonts/cormorant-garamond/600SemiBold/CormorantGaramond_600SemiBold.ttf'),
 'Cormorant-Regular':require('@expo-google-fonts/cormorant-garamond/400Regular/CormorantGaramond_400Regular.ttf'),
 'Amiri-Regular':require('@expo-google-fonts/amiri/400Regular/Amiri_400Regular.ttf'),
};
export function useUiFonts(){const [ready]=useFonts(fontAssets);loaded=ready;return ready;}
export const titleFont=()=>loaded?'Cormorant-Semibold':undefined;
export const arabicFont=()=>loaded?'Amiri-Regular':undefined;

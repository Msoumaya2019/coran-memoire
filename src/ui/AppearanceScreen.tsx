import React from 'react';
import {View} from 'react-native';
import {AppState,touch} from '../core/program';
import {useTheme} from './theme';
import {AccentSelector,Heading,ThemeSelector} from './DesignSystem';
export function AppearanceScreen({state,update}:{state:AppState;update:(state:AppState)=>void}){const {accent}=useTheme();return <View><View style={{marginTop:16,marginBottom:16}}><Heading size={24}>Thème de l’application</Heading></View><ThemeSelector theme={state.theme??'white'} onSelect={theme=>update(touch({...state,theme}))}/><View style={{marginTop:20,marginBottom:16}}><Heading size={24}>Couleur d’accent</Heading></View><AccentSelector value={state.accent??accent} onSelect={accent=>update(touch({...state,accent}))}/></View>;}

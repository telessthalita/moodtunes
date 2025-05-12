
export const getMoodEmoji = (mood: string): string => {
  const lowerCaseMood = mood.toLowerCase();

  if (lowerCaseMood.includes('happy') || lowerCaseMood.includes('feliz') || lowerCaseMood.includes('alegre')) {
    return '😊';
  } else if (lowerCaseMood.includes('sad') || lowerCaseMood.includes('triste')) {
    return '😔';
  } else if (lowerCaseMood.includes('calm') || lowerCaseMood.includes('calmo') || lowerCaseMood.includes('tranquilo')) {
    return '😌';
  } else if (lowerCaseMood.includes('energetic') || lowerCaseMood.includes('energético') || lowerCaseMood.includes('energico')) {
    return '⚡';
  } else if (lowerCaseMood.includes('relax') || lowerCaseMood.includes('relaxado')) {
    return '💆';
  } else if (lowerCaseMood.includes('angry') || lowerCaseMood.includes('irritado') || lowerCaseMood.includes('enojado') || lowerCaseMood.includes('raivoso')) {
    return '😠';
  } else if (lowerCaseMood.includes('anxious') || lowerCaseMood.includes('ansioso')) {
    return '😰';
  } else if (lowerCaseMood.includes('excited') || lowerCaseMood.includes('empolgado') || lowerCaseMood.includes('emocionado') || lowerCaseMood.includes('animado')) {
    return '🤩';
  } else if (lowerCaseMood.includes('nostalgic') || lowerCaseMood.includes('nostálgico')) {
    return '🥹';
  } else if (lowerCaseMood.includes('romantic') || lowerCaseMood.includes('romântico') || lowerCaseMood.includes('romantico')) {
    return '❤️';
  } else if (lowerCaseMood.includes('focus') || lowerCaseMood.includes('focado') || lowerCaseMood.includes('concentrado')) {
    return '🧠';
  } else if (lowerCaseMood.includes('party') || lowerCaseMood.includes('festa') || lowerCaseMood.includes('fiesta')) {
    return '🎉';
  } else if (lowerCaseMood.includes('tired') || lowerCaseMood.includes('cansado')) {
    return '😴';
  } else if (lowerCaseMood.includes('motivado') || lowerCaseMood.includes('motivated')) {
    return '💪';
  }
  
  // Default emoji if no match
  return '🎵';
};

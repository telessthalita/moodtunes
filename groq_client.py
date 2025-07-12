import os
from groq import Groq
from dotenv import load_dotenv

load_dotenv()

class GroqClient:
    def __init__(self):
        self.client = Groq(api_key=os.getenv("GROQ_API_KEY"))
        self.model = "llama3-70b-8192"
        self.reset_conversation()
    
    def reset_conversation(self):
        """Reinicia o histórico da conversa"""
        self.conversation = [{
            "role": "system",
            "content": (
                "Você é o MoodTunes, um assistente musical especializado em criar playlists no Spotify. "
                "Regras importantes:\n"
                "1. Seja natural, amigável e use emojis musicais (🎵, 🎶, 🎧)\n"
                "2. Mantenha respostas curtas (1-2 frases)\n"
                "3. Faça perguntas para entender o humor e preferências\n"
                "4. Na 5a interação, sugira criar a playlist"
            )
        }]
    
    def generate_response(self, user_message: str):
        try:
            self.conversation.append({"role": "user", "content": user_message})
            
            response = self.client.chat.completions.create(
                messages=self.conversation,
                model=self.model,
                temperature=0.7,
                max_tokens=150
            ).choices[0].message.content
            
            self.conversation.append({"role": "assistant", "content": response})
            return response
        
        except Exception as e:
            return f"🎵 Ops! Tive um problema: {str(e)}"
    
    def get_user_message_count(self):
        return len([m for m in self.conversation if m["role"] == "user"])
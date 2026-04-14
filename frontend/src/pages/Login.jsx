import { useState } from 'react';
import { supabase } from '../supabaseClient';
import { Mail, Lock, Loader2, ArrowRight } from 'lucide-react';

export default function Login() {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);

  const handleAuth = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    const { error } = isSignUp 
      ? await supabase.auth.signUp({ 
          email, 
          password,
          options: {
            emailRedirectTo: window.location.origin
          }
        })
      : await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      alert(error.message);
    } else if (isSignUp) {
      alert('Vérifiez vos e-mails pour confirmer l\'inscription !');
    }
    
    setLoading(false);
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-white font-sans overflow-hidden">
      {/* Image de fond en filigrane (Transparent sur blanc) */}
      <div 
        className="absolute inset-0 z-0 opacity-[0.15] bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: "url('https://images.unsplash.com/photo-1631549916768-4119b2e5f926?q=80&w=2000&auto=format&fit=crop')" }}
      ></div>

      {/* Dégradé radial pour un effet de lumière centrale */}
      <div className="absolute inset-0 z-1 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-emerald-50/40 via-transparent to-transparent"></div>

      <div className="relative z-10 w-full max-w-md px-6">
        {/* Conteneur très propre et léger */}
        <div className="bg-white/60 backdrop-blur-md border border-emerald-100 rounded-[2rem] shadow-xl shadow-emerald-900/5 p-10">
          <div className="text-center mb-10">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-emerald-500 rounded-2xl mb-4 shadow-lg shadow-emerald-200">
              <span className="text-white text-3xl font-bold">+</span>
            </div>
            <h2 className="text-2xl font-bold text-gray-800 tracking-tight">
              {isSignUp ? 'Créer un compte' : 'Gestock Pharma'}
            </h2>
            <p className="mt-1 text-gray-500 text-sm">
              Logiciel de gestion d'officine
            </p>
          </div>

          <form onSubmit={handleAuth} className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-emerald-700 uppercase ml-1">Email</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-emerald-600/40" />
                <input
                  type="email"
                  required
                  className="w-full bg-emerald-50/50 border border-emerald-100 rounded-xl py-3.5 pl-12 pr-4 text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:bg-white transition-all"
                  placeholder="votre@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-emerald-700 uppercase ml-1">Mot de passe</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-emerald-600/40" />
                <input
                  type="password"
                  required
                  className="w-full bg-emerald-50/50 border border-emerald-100 rounded-xl py-3.5 pl-12 pr-4 text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:bg-white transition-all"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-4 rounded-xl shadow-lg shadow-emerald-200 flex items-center justify-center gap-2 group transition-all mt-6 active:scale-95"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <span>{isSignUp ? "S'inscrire" : "Se connecter"}</span>
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </form>

          <div className="mt-8 text-center">
            <button 
              onClick={() => setIsSignUp(!isSignUp)}
              className="text-sm font-medium text-emerald-600 hover:text-emerald-800 transition-colors"
            >
              {isSignUp ? "Déjà inscrit ? Connexion" : "Nouvelle pharmacie ? Créer un profil"}
            </button>
          </div>
        </div>
        
        <p className="mt-8 text-center text-xs text-gray-400 font-medium">
          © 2026 Gestock Pharma — Système d'Inventaire Certifié
        </p>
      </div>
    </div>
  );
}

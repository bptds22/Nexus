package ca.nexussports.app;

import android.graphics.Color;
import android.graphics.drawable.ColorDrawable;
import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // Android 15+ (API 35+) : edge-to-edge est FORCÉ par le système (targetSdk 36),
        // les barres sont transparentes et statusBarColor / setBackgroundColor sont
        // dépréciés (@capacitor/status-bar 8.0.2 y est inerte). Le blanc résiduel venait
        // du FOND DE FENÊTRE blanc par défaut, visible derrière les barres transparentes.
        // On le passe en #111317 → barre sombre (filet anti-gap ; le body WebView #111317
        // recouvre par-dessus). Le padding du contenu reste la propriété UNIQUE du CSS
        // env(safe-area-inset-top) (.nx-safe-top, partagé iOS/Android) → pas de double.
        // Les glyphes clairs viennent de StatusBar.setStyle(Dark) (bootstrap JS). iOS non concerné.
        getWindow().setBackgroundDrawable(new ColorDrawable(Color.parseColor("#111317")));
    }
}

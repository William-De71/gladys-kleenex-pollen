# Kleenex Pollen Radar

## Überblick

Diese Integration bringt die **vom Kleenex-Pollenradar gezählten Pollen** (Scottex in Italien) für eine bis drei Städte in Gladys: die Zahl der Pollenkörner pro m³ Luft für **Bäume**, **Gräser** und **Kräuter**, ihre Stufe (niedrig, mäßig, hoch, sehr hoch), die **Hauptarten** (Birke, Ambrosia, Süßgräser…) und die Prognose für die nächsten vier Tage. Jede Stadt wird zu einem Gerät, das Sie auf einem Dashboard anzeigen und in Szenen verwenden können.

Abgedeckte Länder: **Frankreich**, **Vereinigtes Königreich und Irland**, **Niederlande**, **Italien** und **USA**. Weder Konto noch Schlüssel sind nötig. In den USA nennt das Radar keine einzelnen Arten.

Dieser Connector ist **inoffiziell** und weder mit Kleenex noch mit Kimberly-Clark verbunden. Er liest dieselben Daten wie die Website, ohne dokumentierte API: Ändert sich die Website, kann er bis zu einem Update ausfallen.

Es ist eine **Cloud**-Integration: Sie fragt alle drei Stunden die Kleenex-Website des gewählten Landes ab, eine Anfrage pro Stadt, und behält die letzte Prognose, sodass ein Neustart keine Anfrage kostet.

## Voraussetzungen

- Gladys Assistant 5.3.0 oder neuer.
- Name oder Postleitzahl der Städte, so wie die Website des Pollenradars sie versteht.

## Konfiguration

| Feld              | Was eingeben                                                                                       |
| ----------------- | -------------------------------------------------------------------------------------------------- |
| Land              | Das Pollenradar, das für alle Städte abgefragt wird. Standard: Frankreich.                         |
| Stadt             | „Utrecht“, „Leeds“, „Mâcon“, „71000“… Für Irland das Land angeben: „Dublin, Ireland“. Pflichtfeld. |
| Stadt 2, Stadt 3  | Weitere Städte (Zweitwohnung, Arbeitsplatz, Schule). Optional.                                     |
| Sprache der Texte | Gerätenamen, Hauptpollen und Szenen-Zusammenfassungen. Automatisch: Ihr Dashboard.                 |

Speichern: Der Status oben auf der Seite zeigt die gelesenen Städte, ihre heutige Pollenstufe und die Uhrzeit der nächsten Abfrage. Eine unbekannte Stadt wird dort gemeldet: Versuchen Sie eine andere Schreibweise oder die Postleitzahl. **Jetzt lesen** liest sofort erneut (höchstens alle 10 Minuten).

## Verwendung

### Geräte

Erstellen Sie im Tab **Entdecken** das Gerät „Pollen …“ jeder Stadt. Es enthält:

- die Pollenstufe heute und morgen, von 1 (niedrig) bis 4 (sehr hoch): die höchste der drei Gruppen;
- die Zahl der Körner pro m³ von Bäumen, Gräsern und Kräutern heute (die Website schreibt „PPM“);
- die Stufe jeder Gruppe heute, von 1 bis 4;
- den Hauptpollen als Text, zum Beispiel „Ambrosia 13“.

Eine Stufe ist eine Zahl von 1 bis 4, kein Luftqualitätsindex: Gladys hat keine Polleneinheit, diese Funktionen zeigen daher keine an. Das Gerät wird über den Standort erkannt, den das Radar zurückgibt: Eine andere Schreibweise, die denselben Ort findet, behält dasselbe Gerät. Der Status der Konfiguration zeigt den vom Radar gefundenen Namen: Prüfen Sie ihn.

### Dashboard-Widgets

![Das Widget Pollenradar für Mâcon (Bäume, Gräser, Kräuter, fünf Tage) und das Widget Pollenarten (generierte Illustration, kein Screenshot)](https://raw.githubusercontent.com/William-De71/gladys-kleenex-pollen/main/docs/assets/widgets.de.png)

- **Pollenradar**: die drei Gruppen von heute, eine Karte pro Tag über fünf Tage (Stufe, Zählungen, Hauptarten), der Hauptpollen, die Quelle und die Uhrzeit der Abfrage.
- **Pollenarten**: die heute gezählten Arten, die häufigsten zuerst, mit ihrer Stufe.

Wählen Sie die Stadt in den Einstellungen des Widgets (leer: die erste).

### Szenen

Der Auslöser **Kleenex: Pollenwarnung** löst aus, wenn Bäume, Gräser oder Kräuter von heute oder morgen „Mäßig“ oder mehr erreichen oder weiter steigen; nie zweimal für denselben Tag, dieselbe Gruppe und dieselbe Stufe. Filtern Sie nach Stadt, Pollenart, Tag und Stufe („Hoch“ und „Sehr hoch“ für die meisten Allergiker). Er liefert einen fertigen Satz, `{{triggerEvent.data.summary}}`, und seine Werte (Gruppe, Stufe, Zählung, Arten).

Die Aktion **Kleenex: Pollen lesen** gibt Stufe, Zählungen und Hauptpollen einer Stadt für heute oder morgen zurück, für eine Nachricht oder eine Bedingung.

Beispiele:

- Wenn Gräser morgen hoch sind → abends die Zusammenfassung senden.
- Wenn Bäume heute sehr hoch sind → die Schlafzimmerfenster schließen.
- Jeden Morgen → die Pollen lesen und mit dem Wecker ansagen.

### Transport

Nur Cloud: Die Daten kommen von der Kleenex- (oder Scottex-) Website des gewählten Landes. Nur die Namen der eingegebenen Städte verlassen Ihr Netzwerk.

## Fehlerbehebung

- **„dem Pollenradar unbekannt“**: Die Website kennt diese Schreibweise nicht; versuchen Sie die Postleitzahl oder eine größere Stadt in der Nähe.
- **„hat die Anfrage abgelehnt (HTTP 403)“**: Die Website hat die Anfrage blockiert; die Integration versucht es in 15 Minuten erneut, dann in größeren Abständen.
- **„Die Website hat sich vielleicht geändert“**: Die Seite sieht nicht mehr so aus, wie die Integration sie lesen kann. Melden Sie es: Ein Update ist nötig.
- **Die Stufe bleibt bei 1**: Außerhalb der Pollensaison ist das normal; die Zählungen bleiben bei oder nahe 0.
- **Um ein Problem zu melden**: Drücken Sie **Diagnose** und kopieren Sie die Zeilen, die mit „Pollen diagnostic“ beginnen, aus dem Tab Protokolle in ein GitHub-Issue oder eine Antwort im Forum, mit den Versionen von Gladys und der Integration.

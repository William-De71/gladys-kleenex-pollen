# Kleenex Pollen Radar

## Présentation

Cette intégration apporte dans Gladys les **pollens comptés par le radar des pollens Kleenex** (Scottex en Italie), pour une à trois villes : le nombre de grains de pollen par m³ d’air pour les **arbres**, les **graminées** et les **herbacées**, leur niveau (faible, modéré, élevé, très élevé), les **principales espèces** (bouleau, ambroisie, graminées…) et la prévision des quatre jours suivants. Chaque ville devient un appareil à afficher sur un tableau de bord et à utiliser dans les scènes.

Pays couverts : **France**, **Royaume-Uni et Irlande**, **Pays-Bas**, **Italie** et **États-Unis**. Aucun compte ni clé n’est nécessaire. Aux États-Unis, le radar ne donne pas le détail par espèce.

Ce connecteur n’est **pas officiel** et n’est affilié ni à Kleenex ni à Kimberly-Clark. Il lit les mêmes données que le site, sans API documentée : si le site change, il peut cesser de fonctionner jusqu’à une mise à jour.

C’est une intégration **cloud** : elle interroge le site Kleenex du pays choisi toutes les trois heures, une requête par ville, et garde la dernière prévision, si bien qu’un redémarrage ne coûte aucune requête.

## Prérequis

- Gladys Assistant 5.1.0 ou plus récent.
- Le nom ou le code postal des villes à suivre, tels que le site du radar des pollens les comprend.

## Configuration

| Champ             | Que saisir                                                                                                              |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Pays              | Le radar des pollens interrogé pour toutes les villes. France par défaut.                                               |
| Ville             | « Mâcon », « 71000 », « Saint-Denis 93200 », « Leeds »… En Irlande, ajoutez le pays : « Dublin, Ireland ». Obligatoire. |
| Ville 2, Ville 3  | D’autres villes (résidence secondaire, travail, école). Facultatif.                                                     |
| Langue des textes | Noms des appareils, pollen principal et résumés des scènes. Automatique : votre tableau de bord.                        |

Enregistrez : l’état en haut de la page affiche les villes lues, leur niveau de pollens du jour et l’heure de la prochaine lecture. Une ville inconnue y est signalée : essayez une autre orthographe ou le code postal. **Lire maintenant** relit tout de suite (au plus toutes les 10 minutes).

## Utilisation

### Appareils

Dans l’onglet **Découverte**, créez l’appareil « Pollens … » de chaque ville. Il contient :

- le niveau de pollens d’aujourd’hui et de demain, de 1 (faible) à 4 (très élevé) : le plus haut des trois types ;
- le nombre de grains par m³ d’arbres, de graminées et d’herbacées aujourd’hui (le site écrit « PPM ») ;
- le niveau de chaque type aujourd’hui, de 1 à 4 ;
- le pollen principal en texte, par exemple « Ambroisie 13 ».

Un niveau est un chiffre de 1 à 4, pas un indice de qualité de l’air : Gladys n’a pas d’unité pour les pollens, ces fonctionnalités n’en affichent donc pas. L’appareil est identifié par la position que le radar renvoie : une autre orthographe qui trouve le même endroit garde le même appareil. L’état de la configuration affiche le nom trouvé par le radar : vérifiez-le.

### Widgets du tableau de bord

![Le widget Radar des pollens pour Mâcon (arbres, graminées, herbacées, cinq jours) et le widget Espèces de pollens (illustration générée, pas une capture d’écran)](https://raw.githubusercontent.com/William-De71/gladys-kleenex-pollen/main/docs/assets/widgets.fr.png)

- **Radar des pollens** : les trois types du jour, une carte par jour sur cinq jours (niveau, comptages, principales espèces), le pollen principal, la source et l’heure de lecture.
- **Espèces de pollens** : les espèces comptées aujourd’hui, les plus présentes d’abord, avec leur niveau.

Choisissez la ville dans les réglages du widget (vide : la première).

### Scènes

Le déclencheur **Kleenex : alerte pollens** se lance quand les arbres, les graminées ou les herbacées d’aujourd’hui ou de demain atteignent « Modéré » ou plus, ou augmentent encore ; jamais deux fois pour le même jour, le même type et le même niveau. Filtrez par ville, type de pollen, jour et niveau (« Élevé » et « Très élevé » pour la plupart des allergiques). Il fournit une phrase toute prête, `{{triggerEvent.data.summary}}`, et ses valeurs (type, niveau, comptage, espèces).

L’action **Kleenex : lire les pollens** renvoie le niveau, les comptages et le pollen principal d’une ville pour aujourd’hui ou demain, à mettre dans un message ou à tester dans une condition.

Exemples :

- Quand les graminées sont élevées demain → envoyer le résumé le soir.
- Quand les arbres sont très élevés aujourd’hui → fermer les fenêtres de la chambre.
- Chaque matin → lire les pollens et les annoncer avec le réveil.

### Transport

Cloud uniquement : les données viennent du site Kleenex (ou Scottex) du pays choisi. Seuls les noms des villes saisies sortent de votre réseau.

## Dépannage

- **« inconnue du radar des pollens »** : le site ne connaît pas cette orthographe ; essayez le code postal, ou une grande ville proche.
- **« a refusé la requête (HTTP 403) »** : le site a bloqué la requête ; l’intégration réessaie dans 15 minutes, puis de plus en plus tard.
- **« le site a peut-être changé »** : la page ne ressemble plus à celle que l’intégration sait lire. Signalez-le : une mise à jour sera nécessaire.
- **Le niveau reste à 1** : hors saison des pollens, c’est normal ; les comptages restent à 0 ou presque.
- **Pour signaler un problème** : appuyez sur **Diagnostic**, puis copiez les lignes commençant par « Pollen diagnostic » de l’onglet Journaux dans une issue GitHub ou une réponse sur le forum, avec les versions de Gladys et de l’intégration.

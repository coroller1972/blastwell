# BLASTWELL

BLASTWELL est un jeu de puzzle inspire de Tetris, dans un puits de briques deja partiellement rempli. Les pieces tombent dans une structure faite de cavites, de cheminees et de briques piegees. L'objectif est de creuser jusqu'au fond du puits en detruisant la vraie ligne du bas pour passer au niveau suivant.

Le jeu se joue en navigateur et utilise JavaScript, Three.js et Vite.

## But Du Jeu

Chaque niveau commence avec un puits pre-rempli. Le joueur doit placer les tetriminos pour completer des lignes et les faire exploser.

Un niveau est termine quand la vraie ligne du bas du board est detruite. Le jeu affiche alors un compte a rebours `3..2..1..GO!`, puis charge le niveau suivant.

## Pieces

Les pieces disponibles sont :

- `O` : carre.
- `I` : barre.
- `T`.
- `L`.
- `J`.
- `Z` : biais.
- `S` : biais inverse.

## Mecaniques De Gameplay

### Lignes

Quand une ligne est complete, elle est detruite avec une animation de gauche a droite. Plusieurs lignes peuvent etre detruites en meme temps.

Score :

- 1 ligne : 10 points.
- 2 lignes : 30 points.
- 3 lignes : 50 points.
- 4 lignes : 100 points.

### Niveaux

Les niveaux changent la largeur du puits :

- Niveau 1 : 9 colonnes.
- Niveau 2 : 11 colonnes.
- Niveau 3 : 13 colonnes.
- Niveau 4 : 15 colonnes.
- Niveau 5 : 18 colonnes.
- Niveau 6 : 25 colonnes.

La vitesse augmente toutes les 10 lignes detruites dans le niveau courant, puis revient a 1 au debut du niveau suivant.

### Bombes

Certaines briques deja presentes au debut d'un niveau sont des bombes.

Une bombe n'explose pas seule. Elle explose uniquement quand la ligne dans laquelle elle se trouve est completee et detruite.

Quand la vague de destruction atteint la bombe :

- une explosion speciale se declenche ;
- une cavite circulaire est creusee autour de la bombe ;
- l'explosion peut detruire des briques voisines ;
- si l'explosion atteint la vraie ligne du bas, le niveau est termine.

Les bombes permettent donc d'ouvrir des passages, de vider une zone dense ou d'accelerer la progression vers le fond.

## Controles

- `Fleche gauche` : deplacer la piece a gauche.
- `Fleche droite` : deplacer la piece a droite.
- `Fleche haut` : rotation principale.
- `Z` : rotation inverse.
- `Fleche bas` : accelerer la chute.
- `Espace` : faire tomber la piece instantanement.
- `P` : pause / reprendre.
- `R` : recommencer.

Le sens de rotation principal peut etre choisi dans l'interface avec le selecteur `Gauche` / `Droite`.

## Audio

Chaque niveau peut avoir sa propre musique. La musique demarre apres le compte a rebours, au moment ou la partie commence vraiment, puis boucle jusqu'a la fin du niveau.

Le jeu utilise aussi des effets sonores pour :

- la descente d'une piece ;
- l'atterrissage ;
- l'explosion de ligne ;
- l'explosion de bombe.

## Lancer Le Projet

Installer les dependances :

```bash
npm install
```

Lancer le serveur de developpement :

```bash
npm run dev
```

Lancer les tests :

```bash
npm test
```

Construire la version de production :

```bash
npm run build
```


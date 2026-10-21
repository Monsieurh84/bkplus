/* BK+ — demandes de devis guidées : photos à prendre pour chaque type de demande (d'après le document BK+) */
window.BK_DEVIS = {
  categories: [
    { id: 'eau-chaude', nom: 'Chauffe-eau & sécurité' },
    { id: 'sanitaires', nom: 'WC & robinetterie' },
    { id: 'sdb', nom: 'Salle de bain' },
    { id: 'cuisine', nom: 'Cuisine' },
    { id: 'reseau', nom: 'Compteur & réseau d’eau' },
    { id: 'autre', nom: 'Autres demandes' },
  ],
  services: [
    { id: 'chauffe-eau', cat: 'eau-chaude', nom: 'Remplacement chauffe-eau', img: 1, photos: [
      ['Photo du chauffe-eau', 'Vue d’ensemble, avec l’étiquette si possible'],
      ['Photo du groupe de sécurité', 'Sous le chauffe-eau'],
      ['Photo de l’évacuation du groupe de sécurité', ''],
      ['Photo de l’arrivée d’eau du groupe de sécurité', ''],
      ['Photo du problème', 'Si fuite ou autre', true] ] },
    { id: 'groupe-securite', cat: 'eau-chaude', nom: 'Remplacement groupe de sécurité', img: 5, photos: [
      ['Photo du chauffe-eau', 'Vue d’ensemble'],
      ['Photo du groupe de sécurité', 'Vue de près'],
      ['Photo du problème', 'Si fuite ou autre', true] ] },
    { id: 'adoucisseur', cat: 'eau-chaude', nom: 'Installation ou remplacement d’un adoucisseur', img: 14, photos: [
      ['Photo de l’adoucisseur', 'Vue d’ensemble (ou de l’emplacement prévu)'],
      ['Photo de l’arrivée d’eau', 'Avant l’adoucisseur'],
      ['Photo de la sortie d’eau', 'Après l’adoucisseur'],
      ['Photo du raccordement à l’évacuation', 'Détail du siphon'],
      ['Photo du branchement électrique', 'Prise visible'],
      ['Photo de l’environnement', 'Espace autour, accès'] ] },
    { id: 'mitigeur-lavabo', cat: 'sanitaires', nom: 'Remplacement mitigeur lavabo', img: 2, photos: [
      ['Photo du robinet', ''],
      ['Photo des arrivées d’eau', 'Sous le lavabo'],
      ['Photo de l’évacuation', ''],
      ['Photo du meuble lavabo ou de l’évier', 'Vue d’ensemble'] ] },
    { id: 'wc', cat: 'sanitaires', nom: 'Remplacement WC', img: 3, photos: [
      ['Photo du WC', 'Vue d’ensemble'],
      ['Photo de l’évacuation / pipe WC', 'Derrière la cuvette'],
      ['Photo de l’arrivée d’eau', ''],
      ['Photo du problème', 'Si fuite ou autre', true] ] },
    { id: 'chasse', cat: 'sanitaires', nom: 'Remplacement mécanisme de chasse', img: 4, photos: [
      ['Photo du WC', 'Vue d’ensemble'],
      ['Photo du mécanisme de chasse', 'Intérieur du réservoir, couvercle retiré'],
      ['Photo de l’arrivée d’eau', ''] ] },
    { id: 'siphon', cat: 'sanitaires', nom: 'Remplacement siphon évier / lavabo', img: 15, photos: [
      ['Photo sous l’évier / lavabo', 'Vue d’ensemble sous l’évier'],
      ['Photo de l’évier / lavabo', 'Vue d’ensemble'] ] },
    { id: 'bonde', cat: 'sanitaires', nom: 'Remplacement bonde évier / lavabo', img: 16, photos: [
      ['Photo de l’évier / lavabo', 'Vue d’ensemble'],
      ['Photo de la bonde', 'Vue de dessous, si accessible', true] ] },
    { id: 'colonne-douche', cat: 'sdb', nom: 'Remplacement colonne de douche', img: 9, photos: [
      ['Photo de la colonne de douche', 'Vue d’ensemble'],
      ['Photo du mitigeur / robinet', 'Vue de près'],
      ['Photo de l’environnement', 'Espace autour, accès'],
      ['Photo de l’étiquette', 'Si visible : marque et modèle', true] ] },
    { id: 'baignoire', cat: 'sdb', nom: 'Remplacement baignoire', img: 10, photos: [
      ['Photo de la longueur de la baignoire', 'Mètre posé d’un bout à l’autre'],
      ['Photo de la largeur de la baignoire', 'Mètre posé d’un bord à l’autre'],
      ['Photo de la hauteur de la baignoire', 'Mètre posé sur le côté'],
      ['Photo du tablier / des parois', 'Vue d’ensemble'],
      ['Photo de la robinetterie', 'Vue de près'],
      ['Photo de la bonde / évacuation', 'Si visible', true],
      ['Photo de l’accès sous la baignoire', 'Si accessible', true],
      ['Photo du problème', 'Fuite, traces, état…', true] ] },
    { id: 'receveur', cat: 'sdb', nom: 'Remplacement receveur de douche', img: 11, photos: [
      ['Photo de la longueur du receveur', 'Mètre posé d’un bout à l’autre'],
      ['Photo de la largeur du receveur', 'Mètre posé d’un bout à l’autre'],
      ['Photo de la hauteur / épaisseur du receveur', 'Mètre posé sur le côté'],
      ['Photo du receveur dans son environnement', 'Vue d’ensemble'],
      ['Photo de la bonde / évacuation', 'Si visible', true],
      ['Photo de l’accès sous le receveur', 'Si accessible', true],
      ['Photo des arrivées d’eau', 'Si accessibles', true],
      ['Photo du problème', 'Fuite, traces, état…', true] ] },
    { id: 'evier', cat: 'cuisine', nom: 'Remplacement évier', img: 13, photos: [
      ['Photo de l’évier', 'Vue d’ensemble'],
      ['Photo de la longueur', 'Mètre posé d’un bord à l’autre de la cuve'],
      ['Photo de la largeur', 'Mètre posé d’un bord à l’autre de la cuve'],
      ['Photo de la profondeur de la cuve', 'Mètre posé du haut vers le bas'],
      ['Photo des raccordements', 'Arrivée d’eau et évacuation sous l’évier'],
      ['Photo de l’encastrement', 'Mètre posé sur la découpe du plan de travail', true] ] },
    { id: 'fuite-compteur', cat: 'reseau', nom: 'Fuite compteur, avant ou après compteur', img: 6, photos: [
      ['Photo du compteur', ''],
      ['Photo avant compteur', ''],
      ['Photo après compteur', ''],
      ['Photo du problème', ''] ] },
    { id: 'reducteur', cat: 'reseau', nom: 'Remplacement ou fuite réducteur de pression', img: 7, photos: [
      ['Photo de l’ensemble', 'Compteur + réducteur de pression'],
      ['Photo du réducteur de pression', 'Vue de près'],
      ['Photo du manomètre', 'Si présent', true],
      ['Photo de l’arrivée d’eau', 'Avant le réducteur'],
      ['Photo de la sortie d’eau', 'Après le réducteur'],
      ['Photo du problème', 'Fuite, traces, corrosion…', true] ] },
    { id: 'vanne', cat: 'reseau', nom: 'Remplacement ou fuite vanne d’arrêt', img: 8, photos: [
      ['Photo de l’ensemble', 'Compteur + vanne d’arrêt'],
      ['Photo de la vanne d’arrêt', 'Vue de près'],
      ['Photo de l’arrivée d’eau', 'Avant la vanne'],
      ['Photo de la sortie d’eau', 'Après la vanne'],
      ['Photo de l’environnement', 'Accessibilité, espace autour'],
      ['Photo du problème', 'Fuite, traces, corrosion…', true] ] },
    { id: 'robinet-exterieur', cat: 'reseau', nom: 'Remplacement robinet extérieur', img: 12, photos: [
      ['Photo du robinet extérieur', 'Vue d’ensemble, si possible avec les raccordements'] ] },
    { id: 'climatisation', cat: 'autre', nom: 'Climatisation (installation, entretien, panne)', img: 0, photos: [] },
    { id: 'autre', cat: 'autre', nom: 'Autre demande / dépannage', img: 0, photos: [] },
  ],
};

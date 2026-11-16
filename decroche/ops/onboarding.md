# Checklist d'installation client (objectif : 48 h)

## 1. Fiche client (15 min au téléphone)
- [ ] Nom commercial exact + prénom du dirigeant
- [ ] Métier, zone d'intervention, horaires
- [ ] Services proposés + prix qu'il accepte d'annoncer (déplacement, diagnostic…)
- [ ] Ce qui est une urgence pour lui, et ce qu'il refuse
- [ ] Numéro mobile pour les SMS + e-mail pour les résumés
- [ ] Agenda (Google / Outlook) si offre Pro
- [ ] Phrase d'accueil souhaitée, voix homme ou femme

## 2. Construction de l'agent (20 min)
- [ ] Dupliquer l'agent démo `agent_3101m7j2g8rseyb9q99xm3mk3zgf` dans ElevenLabs
- [ ] Remplacer les infos fictives par la fiche client
- [ ] Brancher le webhook post-appel → SMS/e-mail résumé
- [ ] Acheter un numéro Twilio FR et le relier à l'agent
- [ ] 5 appels de test (urgence, devis, hors zone, client énervé, « vous êtes un robot ? »)

## 3. Mise en service (5 min avec le client)
- [ ] Renvoi d'appel sur non-réponse / occupé vers le numéro Twilio
  - Orange / Sosh : `**61*NUMERO#` (non-réponse), `**67*NUMERO#` (occupé)
  - SFR, Bouygues, Free : mêmes codes GSM standards, ou via l'espace client
- [ ] Appel test en direct avec le client
- [ ] Stripe : abonnement activé, facture d'installation envoyée

## 4. Suivi
- J+7 : appel « tout va bien ? » + ajustements du script
- J+30 : rapport (nb d'appels, nb de demandes, chantiers gagnés) + demande de témoignage + demande de 2 recommandations

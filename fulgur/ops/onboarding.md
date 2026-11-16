# Installation d'un pilote (5 jours ouvrés)

**J1 : cadrage (45 min avec le client)**
- [ ] Sources de leads (formulaire site, Meta Lead Ads, portails, Google Ads) et volume mensuel
- [ ] Fiche produit / programmes, prix publics, arguments, réponses aux 10 questions les plus fréquentes
- [ ] Critères de qualification et définition d'un « bon RDV »
- [ ] Agenda des commerciaux (Google / Outlook / outil de RDV) et CRM
- [ ] Horaires d'appel autorisés, nom et voix de l'assistante
- [ ] Signature : bon de commande + DPA RGPD (Fulgur = sous-traitant)
- [ ] Mesure de départ (baseline) : délai de rappel actuel, % joints, % RDV sur les 30 derniers jours

**J2 : agent**
- [ ] Dupliquer l'agent démo `agent_1301m7j9jy8xfn985p1jxt3kntk8`, remplacer le contenu fictif
- [ ] Mettre `{{prenom}}` et `{{programme}}` dans le premier message
- [ ] Data collection : projet, typologie, budget, financement, délai, RDV pris (oui/non), créneau
- [ ] Outil de réservation d'agenda (webhook tool) si disponible
- [ ] 10 appels de test : pressé, méfiant, hors budget, « vous êtes un robot ? », mauvais numéro

**J3 : branchements**
- [ ] Numéro Twilio FR dédié importé dans ElevenLabs
- [ ] Instance du moteur (ou ajout du client à l'instance existante) + variables
- [ ] Formulaire / Zapier / Make → `POST /lead?key=...`
- [ ] Webhook post-appel ElevenLabs → `/webhooks/elevenlabs` ; résultats → CRM du client

**J4 : recette avec le client** : 5 vrais leads de test, validation du ton et du résumé

**J5 : mise en production**

**Suivi** : rapport hebdomadaire (leads, joints, qualifiés, RDV, coût par RDV comparé à la baseline). À J+25 : rendez-vous de conversion vers Growth/Scale.

# Fulgur : chaque lead rappelé en 30 secondes

> Les entreprises paient leurs leads 30 à 150 €. Puis elles les rappellent 4 heures plus tard, quand le prospect a déjà parlé à un concurrent.
> Fulgur rappelle chaque nouveau lead **en moins de 30 secondes**, avec une voix IA naturelle, le qualifie et réserve le rendez-vous dans l'agenda des commerciaux.

## 1. Pourquoi c'est plus puissant que Décroche
| | Décroche (en pause) | **Fulgur** |
|---|---|---|
| Client | Artisan, petit budget | Entreprise qui **achète déjà des leads** (5 à 100 k€/mois de pub) |
| Prix | 149-290 €/mois | **1 490 à 4 900 €/mois** + installation 2 000 à 5 000 € |
| Clients pour 100 k€/mois | ~400 | **~40 à 50** |
| Valeur prouvable | « des appels en plus » | « +X rendez-vous, coût par RDV divisé par Y » (chiffres de leur propre CRM) |
| Vente | 400 petites ventes | 50 ventes à forte valeur, chacune peut rapporter des recommandations |

La logique : quand un lead est rappelé dans les 5 premières minutes, il a beaucoup plus de chances d'être joint et qualifié que s'il est rappelé une heure après. C'est un constat largement partagé dans la vente. On mesurera le gain réel chez chaque client pendant le pilote.

## 2. Le produit
1. Un lead arrive (formulaire du site, Meta Lead Ads, Google Ads, portail type SeLoger, Zapier…).
2. Le moteur Fulgur (`moteur/`) reçoit le lead et déclenche en quelques secondes un **appel sortant** de l'agent vocal ElevenLabs via un numéro Twilio.
3. L'agent confirme la demande, qualifie (projet, budget, financement, délai) et **réserve un RDV**.
4. Fin d'appel : résumé + note de qualification envoyés au CRM / e-mail / Slack du client. Pas de réponse : 2 nouvelles tentatives + SMS.
5. Tableau de bord mensuel : leads reçus, joints, qualifiés, RDV, coût par RDV.

**Légalité (France)** : on appelle uniquement des personnes qui **viennent de demander à être contactées** via un formulaire (consentement), jamais de prospection à froid de particuliers. L'agent se présente comme assistant vocal s'il est interrogé. Le client reste responsable de traitement, Fulgur est sous-traitant (DPA RGPD signé).

**Démo live** (promoteur fictif « Résidences Belvédère ») :
https://elevenlabs.io/app/talk-to?agent_id=agent_1301m7j9jy8xfn985p1jxt3kntk8

## 3. Niches (dans cet ordre)
1. **Promoteurs immobiliers et commercialisateurs du neuf** : leads chers (souvent 50 à 150 €), panier énorme, équipes commerciales débordées le soir et le week-end.
2. **Concessions et groupes automobiles** : demandes d'essai et de reprise.
3. **Écoles privées et organismes de formation** : demandes de documentation, pics de rentrée.
4. **Courtiers (crédit immobilier, assurance)** : volume élevé, rapidité décisive.
5. **Cuisinistes, piscinistes, véranda, menuiserie haut de gamme** : demandes de devis.

À éviter au début : santé (données sensibles) et rénovation énergétique (secteur sous surveillance pour le démarchage).

## 4. Offre et prix
| Offre | Installation | Mensuel | Contenu |
|---|---|---|---|
| **Pilote 30 jours** | — | **990 €** (déduit si on continue) | 1 source de leads, jusqu'à 300 leads, rapport de résultats |
| **Growth** | 1 990 € | **1 490 €/mois** | jusqu'à 1 000 leads/mois, 1 CRM, agenda, relances SMS |
| **Scale** | 4 900 € | **2 990 €/mois** | jusqu'à 3 000 leads, multi-programmes/multi-sites, relances 7 jours |
| **Enterprise** | sur devis | 4 900 €+/mois | volumes, plusieurs marques, intégration sur mesure |

Option performance possible : 25 à 40 € par RDV honoré au-delà d'un seuil.
Coût de revient estimé : 0,30 à 0,60 € par lead traité (minutes voix + téléphonie + LLM) → **marge brute 75 à 85 %**.

## 5. Chemin vers 100 k€/mois (objectif, pas une promesse)
Panier moyen visé : 2 200 €/mois.

| Date | Clients | MRR | Levier |
|---|---|---|---|
| 31 déc. 2026 | 3 pilotes payants | ~3 000 € encaissés | Toi + la démo, 15 rendez-vous décideurs |
| Mars 2027 | 10 | 20 000 € | Pilotes convertis + 1er cas client chiffré |
| Juin 2027 | 22 | 48 000 € | 1 commercial senior (fixe + commission), LinkedIn + événements immobilier |
| Sept. 2027 | 34 | 75 000 € | 2e niche (auto), partenariats agences marketing qui vendent les leads |
| **Déc. 2027** | **45** | **≈ 100 000 €** | 2 commerciaux, 1 ingénieur intégration, 1 responsable compte |

Hypothèses à vérifier en janvier-février 2027 : pilote → client ≥ 50 %, churn ≤ 2 %/mois, cycle de vente ≤ 30 jours. Si elles ne tiennent pas, on change de niche avant d'embaucher.

## 6. Plan d'action jusqu'au 31 décembre 2026
**Semaine 1 (16-22 nov.)**
- [ ] Domaine (fulgur.fr / getfulgur.com / fulgur-ia.fr) + mise en ligne de `site/index.html`
- [ ] Twilio : acheter 1 numéro français, l'importer dans ElevenLabs (Agents → Phone numbers)
- [ ] Déployer `moteur/` (Render, Railway ou un petit VPS), tester avec ton propre formulaire : tu remplis, ton téléphone sonne en moins de 30 s. **Cette vidéo est ton meilleur argument commercial.**
- [ ] Liste de 150 promoteurs / commercialisateurs (directeurs commerciaux, directeurs marketing)

**Semaine 2-3 (23 nov.-6 déc.)**
- [ ] « Test du lead » : remplis le formulaire de 30 promoteurs, note le délai de rappel (souvent des heures, parfois jamais). Envoie le résultat à chacun (voir `vente/sequence.md`).
- [ ] 10 messages LinkedIn + 20 e-mails par jour → objectif 15 démos
- [ ] Vendre 3 pilotes à 990 €

**Semaine 4-6 (7-31 déc.)**
- [ ] Installer les pilotes en 5 jours ouvrés max (`ops/onboarding.md`)
- [ ] Rapport hebdomadaire à chaque pilote ; préparer la conversion en Growth pour janvier
- [ ] Contacter 10 agences marketing immobilier pour un partenariat revendeur (20 % récurrent)

## 7. Stack
- Agent vocal : ElevenLabs Agents (connecté) · Téléphonie : Twilio
- Moteur : `moteur/server.mjs` (Node 20, zéro dépendance) : réception des leads → appel sortant → résumé post-appel
- CRM clients : webhook générique (HubSpot, Pipedrive, Salesforce, Google Sheets via Zapier/Make)
- Paiement : Stripe · Prospection : Clay + Gmail (connectés), LinkedIn

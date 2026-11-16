# Décroche : la réceptionniste IA des artisans et TPE

> « Vos appels, toujours décrochés. »

## 1. Le problème
Un artisan (plombier, électricien, couvreur, garagiste…) est sur un chantier les mains prises.
Il rate une bonne partie de ses appels. Un appel raté, c'est souvent un client qui appelle le concurrent suivant.
Un chantier moyen vaut 300 € à 5 000 €. **Rater 2 appels par semaine = plusieurs milliers d'euros perdus par mois.**

## 2. La solution
Une réceptionniste vocale IA (voix française naturelle, ElevenLabs) qui :
- décroche 24h/24, 7j/7, au nom de l'entreprise ;
- qualifie le besoin et l'urgence ;
- prend nom, téléphone, adresse, créneau ;
- envoie un résumé par SMS / e-mail à l'artisan en moins d'une minute ;
- (option) prend rendez-vous directement dans son agenda.

Mise en place : renvoi d'appel (« si occupé / pas de réponse ») vers notre numéro. Zéro changement de numéro pour le client.

**Démo live déjà créée** : agent `agent_3101m7j2g8rseyb9q99xm3mk3zgf` (Léa, « Durand Plomberie Chauffage », entreprise fictive)
→ https://elevenlabs.io/app/talk-to?agent_id=agent_3101m7j2g8rseyb9q99xm3mk3zgf

## 3. Pourquoi ce business (et pas un autre)
| Critère | Décroche |
|---|---|
| Premier euro rapide | Oui : frais d'installation payés à la signature, dès décembre 2026 |
| Revenu récurrent | Abonnement mensuel, peu de churn si ça ramène des chantiers |
| ROI évident pour le client | 1 chantier récupéré par mois rembourse l'abonnement |
| Marché | ~1,3 M d'entreprises artisanales en France, + cabinets, garages, agences |
| Technique | Déjà disponible (ElevenLabs Agents + numéro Twilio), pas besoin de coder un produit de zéro |
| Scalable | Un agent = un prompt + une fiche entreprise. Duplicable en 30 min |

## 4. Offre et prix
| Offre | Installation | Mensuel | Contenu |
|---|---|---|---|
| **Essentiel** | 290 € | 149 €/mois | Décroche quand vous ne répondez pas, résumé SMS + e-mail, 300 min |
| **Pro** (cible) | 490 € | 290 €/mois | 24/7, prise de RDV agenda, FAQ / tarifs personnalisés, 800 min |
| **Multi-sites / Agences** | sur devis | 590 €+/mois | Plusieurs numéros, routage, CRM |

Garantie : « Si Décroche ne vous ramène pas au moins un chantier le premier mois, on vous rembourse le mois. »
Coût de revient estimé : 25 à 60 €/client/mois (minutes voix + numéro + LLM) → **marge brute ≈ 80 %**.

## 5. Chemin vers 100 k€/mois (objectif, pas une promesse)
Panier moyen visé : 250 €/mois.

| Date | Clients actifs | MRR | Comment |
|---|---|---|---|
| 31 déc. 2026 | 10 | 2 500 € + ~4 000 € d'installations | Fondateur seul, prospection directe (appels + e-mails) |
| Mars 2027 | 60 | 15 000 € | 1er commercial à la commission, partenariats experts-comptables |
| Juin 2027 | 160 | 40 000 € | Pubs Meta/Google ciblées métiers, vidéos TikTok « appel raté = argent perdu » |
| Sept. 2027 | 280 | 70 000 € | Revendeurs (agences web, fournisseurs pros), offre Agences |
| Déc. 2027 | **400** | **100 000 €** | 3 commerciaux, 1 personne onboarding, churn < 3 %/mois |

Hypothèses clés à vérifier dès décembre : taux de closing après démo ≥ 20 %, churn ≤ 3 %/mois, coût d'acquisition ≤ 400 €.
Si ces chiffres ne tiennent pas en février 2027, on ajuste (niche, prix, canal) avant d'embaucher.

## 6. Niches prioritaires (dans cet ordre)
1. Plombiers / chauffagistes (urgences, gros paniers, hiver = pic)
2. Électriciens, serruriers, couvreurs
3. Garages auto indépendants
4. Cabinets (kinés, ostéos, vétérinaires) : volume d'appels énorme
5. Agences immobilières (leads entrants)

Commencer par **une seule ville + un seul métier** (ex. plombiers de ta ville) pour avoir des témoignages vite.

## 7. Plan d'action : 6 semaines jusqu'au 31 décembre 2026
**Semaine 1 (16-22 nov.)**
- [ ] Acheter le nom de domaine (decroche.fr / decroche-ia.fr / getdecroche.com) et mettre en ligne `site/index.html`
- [ ] Créer la micro-entreprise / SASU si pas déjà fait, ouvrir Stripe (liens de paiement)
- [ ] Tester la démo Léa 10 fois, ajuster la voix et le script
- [ ] Liste de 300 artisans de ta ville (Google Maps / Pages Jaunes, ou Clay)

**Semaine 2 (23-29 nov.)**
- [ ] 40 appels par jour avec le script `vente/script-appel.md` → objectif 15 démos
- [ ] Appel « mystère » : appeler les artisans à 10h en semaine ; noter qui ne décroche pas = prospect n°1
- [ ] Offre de lancement : installation offerte pour les 10 premiers (« membres fondateurs »)

**Semaine 3-4 (30 nov.-13 déc.)**
- [ ] Installer les premiers clients (checklist `ops/onboarding.md`), 48 h max
- [ ] Demander un témoignage vidéo de 30 s à chaque client satisfait
- [ ] Séquence e-mail `vente/emails.md` sur le reste de la liste

**Semaine 5-6 (14-31 déc.)**
- [ ] 10 clients payants, 1er rapport mensuel envoyé à chacun (« Léa a pris 37 appels, 9 nouveaux chantiers »)
- [ ] Contacter 20 experts-comptables pour un partenariat (20 % de commission récurrente)

## 8. Stack
- Voix / agent : ElevenLabs Agents (déjà connecté)
- Numéro : Twilio (numéro français 09 / 01) relié à l'agent
- Résumés : webhook post-appel ElevenLabs → e-mail/SMS (Make/Zapier ou petit script)
- Paiement : Stripe (abonnement + frais d'installation)
- Prospection : Clay (connecté) + Gmail (connecté) pour l'envoi

## 9. Règles à respecter
- L'agent dit qu'il est une IA si on le lui demande ; mention dans le message d'accueil si le client le souhaite.
- RGPD : informer que l'appel est traité/enregistré, contrat de sous-traitance (DPA) avec chaque client, données hébergées UE quand possible.
- Prospection B2B par e-mail : autorisée en France si le message concerne l'activité pro du destinataire + lien de désinscription.
- Démarchage téléphonique B2B : autorisé ; ne pas appeler les numéros perso inscrits sur Bloctel.

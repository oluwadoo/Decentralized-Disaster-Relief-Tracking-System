(define-constant ERR-NOT-AUTHORIZED u100)
(define-constant ERR-INVALID-TITLE u101)
(define-constant ERR-INVALID-DESCRIPTION u102)
(define-constant ERR-INVALID-DISASTER-TYPE u103)
(define-constant ERR-INVALID-LOCATION u104)
(define-constant ERR-INVALID-TARGET-AMOUNT u105)
(define-constant ERR-CAMPAIGN-ALREADY-EXISTS u106)
(define-constant ERR-CAMPAIGN-NOT-FOUND u107)
(define-constant ERR-INVALID-TIMESTAMP u108)
(define-constant ERR-AUTHORITY-NOT-VERIFIED u109)
(define-constant ERR-INVALID-START-TIME u110)
(define-constant ERR-INVALID-END-TIME u111)
(define-constant ERR-CAMPAIGN-UPDATE-NOT-ALLOWED u112)
(define-constant ERR-INVALID-UPDATE-PARAM u113)
(define-constant ERR-MAX-CAMPAIGNS-EXCEEDED u114)
(define-constant ERR-INVALID-CAMPAIGN-TYPE u115)
(define-constant ERR-INVALID-CURRENCY u116)
(define-constant ERR-INVALID-STATUS u117)
(define-constant ERR-INVALID-MIN-DONATION u118)
(define-constant ERR-INVALID-MAX-AID u119)
(define-constant ERR-INVALID-GOAL u120)

(define-data-var next-campaign-id uint u0)
(define-data-var max-campaigns uint u1000)
(define-data-var creation-fee uint u1000)
(define-data-var authority-contract (optional principal) none)

(define-map campaigns
  uint
  {
    title: (string-ascii 100),
    description: (string-utf8 500),
    disaster-type: (string-ascii 50),
    location: (string-ascii 100),
    target-amount: uint,
    start-time: uint,
    end-time: uint,
    timestamp: uint,
    owner: principal,
    campaign-type: (string-ascii 50),
    currency: (string-ascii 20),
    status: bool,
    min-donation: uint,
    max-aid: uint,
    goal: uint
  }
)

(define-map campaigns-by-title
  (string-ascii 100)
  uint)

(define-map campaign-updates
  uint
  {
    update-title: (string-ascii 100),
    update-description: (string-utf8 500),
    update-target-amount: uint,
    update-timestamp: uint,
    updater: principal
  }
)

(define-read-only (get-campaign (id uint))
  (map-get? campaigns id)
)

(define-read-only (get-campaign-updates (id uint))
  (map-get? campaign-updates id)
)

(define-read-only (is-campaign-registered (title (string-ascii 100)))
  (is-some (map-get? campaigns-by-title title))
)

(define-private (validate-title (title (string-ascii 100)))
  (if (and (> (len title) u0) (<= (len title) u100))
      (ok true)
      (err ERR-INVALID-TITLE))
)

(define-private (validate-description (desc (string-utf8 500)))
  (if (and (> (len desc) u0) (<= (len desc) u500))
      (ok true)
      (err ERR-INVALID-DESCRIPTION))
)

(define-private (validate-disaster-type (dtype (string-ascii 50)))
  (if (or (is-eq dtype "earthquake") (is-eq dtype "flood") (is-eq dtype "hurricane") (is-eq dtype "wildfire"))
      (ok true)
      (err ERR-INVALID-DISASTER-TYPE))
)

(define-private (validate-location (loc (string-ascii 100)))
  (if (and (> (len loc) u0) (<= (len loc) u100))
      (ok true)
      (err ERR-INVALID-LOCATION))
)

(define-private (validate-target-amount (amount uint))
  (if (> amount u0)
      (ok true)
      (err ERR-INVALID-TARGET-AMOUNT))
)

(define-private (validate-start-time (stime uint))
  (if (>= stime block-height)
      (ok true)
      (err ERR-INVALID-START-TIME))
)

(define-private (validate-end-time (etime uint) (stime uint))
  (if (> etime stime)
      (ok true)
      (err ERR-INVALID-END-TIME))
)

(define-private (validate-campaign-type (ctype (string-ascii 50)))
  (if (or (is-eq ctype "emergency") (is-eq ctype "recovery") (is-eq ctype "prevention"))
      (ok true)
      (err ERR-INVALID-CAMPAIGN-TYPE))
)

(define-private (validate-currency (cur (string-ascii 20)))
  (if (or (is-eq cur "STX") (is-eq cur "USD") (is-eq cur "BTC"))
      (ok true)
      (err ERR-INVALID-CURRENCY))
)

(define-private (validate-min-donation (min uint))
  (if (> min u0)
      (ok true)
      (err ERR-INVALID-MIN-DONATION))
)

(define-private (validate-max-aid (max uint))
  (if (> max u0)
      (ok true)
      (err ERR-INVALID-MAX-AID))
)

(define-private (validate-goal (goal uint))
  (if (> goal u0)
      (ok true)
      (err ERR-INVALID-GOAL))
)

(define-private (validate-principal (p principal))
  (if (not (is-eq p 'SP000000000000000000002Q6VF78))
      (ok true)
      (err ERR-NOT-AUTHORIZED))
)

(define-public (set-authority-contract (contract-principal principal))
  (begin
    (try! (validate-principal contract-principal))
    (asserts! (is-none (var-get authority-contract)) (err ERR-AUTHORITY-NOT-VERIFIED))
    (var-set authority-contract (some contract-principal))
    (ok true)
  )
)

(define-public (set-max-campaigns (new-max uint))
  (begin
    (asserts! (> new-max u0) (err ERR-INVALID-UPDATE-PARAM))
    (asserts! (is-some (var-get authority-contract)) (err ERR-AUTHORITY-NOT-VERIFIED))
    (var-set max-campaigns new-max)
    (ok true)
  )
)

(define-public (set-creation-fee (new-fee uint))
  (begin
    (asserts! (>= new-fee u0) (err ERR-INVALID-UPDATE-PARAM))
    (asserts! (is-some (var-get authority-contract)) (err ERR-AUTHORITY-NOT-VERIFIED))
    (var-set creation-fee new-fee)
    (ok true)
  )
)

(define-public (create-campaign
  (title (string-ascii 100))
  (description (string-utf8 500))
  (disaster-type (string-ascii 50))
  (location (string-ascii 100))
  (target-amount uint)
  (start-time uint)
  (end-time uint)
  (campaign-type (string-ascii 50))
  (currency (string-ascii 20))
  (min-donation uint)
  (max-aid uint)
  (goal uint)
)
  (let (
        (next-id (var-get next-campaign-id))
        (current-max (var-get max-campaigns))
        (authority (var-get authority-contract))
      )
    (asserts! (< next-id current-max) (err ERR-MAX-CAMPAIGNS-EXCEEDED))
    (try! (validate-title title))
    (try! (validate-description description))
    (try! (validate-disaster-type disaster-type))
    (try! (validate-location location))
    (try! (validate-target-amount target-amount))
    (try! (validate-start-time start-time))
    (try! (validate-end-time end-time start-time))
    (try! (validate-campaign-type campaign-type))
    (try! (validate-currency currency))
    (try! (validate-min-donation min-donation))
    (try! (validate-max-aid max-aid))
    (try! (validate-goal goal))
    (asserts! (is-none (map-get? campaigns-by-title title)) (err ERR-CAMPAIGN-ALREADY-EXISTS))
    (let ((authority-recipient (unwrap! authority (err ERR-AUTHORITY-NOT-VERIFIED))))
      (try! (stx-transfer? (var-get creation-fee) tx-sender authority-recipient))
    )
    (map-set campaigns next-id
      {
        title: title,
        description: description,
        disaster-type: disaster-type,
        location: location,
        target-amount: target-amount,
        start-time: start-time,
        end-time: end-time,
        timestamp: block-height,
        owner: tx-sender,
        campaign-type: campaign-type,
        currency: currency,
        status: true,
        min-donation: min-donation,
        max-aid: max-aid,
        goal: goal
      }
    )
    (map-set campaigns-by-title title next-id)
    (var-set next-campaign-id (+ next-id u1))
    (print { event: "campaign-created", id: next-id })
    (ok next-id)
  )
)

(define-public (update-campaign
  (campaign-id uint)
  (update-title (string-ascii 100))
  (update-description (string-utf8 500))
  (update-target-amount uint)
)
  (let ((campaign (map-get? campaigns campaign-id)))
    (match campaign
      c
        (begin
          (asserts! (is-eq (get owner c) tx-sender) (err ERR-NOT-AUTHORIZED))
          (try! (validate-title update-title))
          (try! (validate-description update-description))
          (try! (validate-target-amount update-target-amount))
          (let ((existing (map-get? campaigns-by-title update-title)))
            (match existing
              existing-id
                (asserts! (is-eq existing-id campaign-id) (err ERR-CAMPAIGN-ALREADY-EXISTS))
              (begin true)
            )
          )
          (let ((old-title (get title c)))
            (if (is-eq old-title update-title)
                (ok true)
                (begin
                  (map-delete campaigns-by-title old-title)
                  (map-set campaigns-by-title update-title campaign-id)
                  (ok true)
                )
            )
          )
          (map-set campaigns campaign-id
            {
              title: update-title,
              description: update-description,
              disaster-type: (get disaster-type c),
              location: (get location c),
              target-amount: update-target-amount,
              start-time: (get start-time c),
              end-time: (get end-time c),
              timestamp: block-height,
              owner: (get owner c),
              campaign-type: (get campaign-type c),
              currency: (get currency c),
              status: (get status c),
              min-donation: (get min-donation c),
              max-aid: (get max-aid c),
              goal: (get goal c)
            }
          )
          (map-set campaign-updates campaign-id
            {
              update-title: update-title,
              update-description: update-description,
              update-target-amount: update-target-amount,
              update-timestamp: block-height,
              updater: tx-sender
            }
          )
          (print { event: "campaign-updated", id: campaign-id })
          (ok true)
        )
      (err ERR-CAMPAIGN-NOT-FOUND)
    )
  )
)

(define-public (deactivate-campaign (campaign-id uint))
  (let ((campaign (unwrap! (map-get? campaigns campaign-id) (err ERR-CAMPAIGN-NOT-FOUND))))
    (asserts! (is-eq tx-sender (get owner campaign)) (err ERR-NOT-AUTHORIZED))
    (map-set campaigns campaign-id (merge campaign { status: false }))
    (print { event: "campaign-deactivated", id: campaign-id })
    (ok true)
  )
)

(define-public (get-campaign-count)
  (ok (var-get next-campaign-id))
)

(define-public (check-campaign-existence (title (string-ascii 100)))
  (ok (is-campaign-registered title))
)
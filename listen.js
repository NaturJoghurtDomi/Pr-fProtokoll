export const STARTLISTEN = {
  typ: ["ASD", "BSD", "CSD", "CSDX", "DSD", "DSDX", "ESD", "FSD"],
  nummern: {},
  ausstattung: [
    "Wärmerückgewinnung", "Wasserkühlung", "Trockner", "SFC",
    "Heizung Motor", "Heizung Schaltschrank", "Heizung Verdichterblock", "Heizung ÖAB",
    "Filtermatte", "Teillast", "Netzwächter"
  ],
  art: ["Mechanisch", "Elektrisch", "Software/Parameter", "Hydraulik/Pneumatik", "Doku/Material", "Sonstiges"],
  verantwortlich: ["Montage", "Vormontage", "Zulieferer", "Konstruktion", "Lager/Material", "Prüfraum", "unklar"],
  bauteil: [
    "Verdichterblock", "Motor", "Frequenzumrichter", "Steuerung", "Schaltschrank",
    "Verkabelung", "Sensorik", "Ventil", "Ölabscheidebehälter", "Kühler",
    "Trockner", "Lüfter", "Rohrleitung", "Verschlauchung", "Gehäuse", "Heizung", "Filter", "Sonstiges"
  ],
  befund: [
    "undicht", "defekt", "falsch montiert", "falsch verkabelt", "fehlt", "falsches Teil",
    "Parameter falsch", "lose", "beschädigt", "verschmutzt", "Funktion fehlerhaft", "Sonstiges"
  ]
};

export function fill(template, values) {
  return template.replace(/\{(\w+)\}/g, (_, key) => String(values[key] ?? ''));
}

export function greetingText(script, client) {
  const text = script.greeting;
  return [
    fill(client.clientName ? text.helloWithName : text.helloWithoutName, client),
    fill(client.managerName ? text.managerWithName : text.managerWithoutName, client),
    fill(client.expiryDate && client.vehicle ? text.expiryAndVehicle : client.expiryDate ? text.expiryOnly : client.vehicle ? text.vehicleOnly : text.noDetails, client),
    text.question
  ].join(' ');
}

export function osagoText(script, client, brief = false) {
  const { insurer, price } = client.osago || {};
  const confirmed = typeof insurer === 'string' && insurer.trim() && Number.isFinite(price) && price > 0;
  const template = brief
    ? (confirmed ? script.osagoOffer.briefConfirmed : script.osagoOffer.briefUnconfirmed)
    : (confirmed ? script.osagoOffer.confirmed : script.osagoOffer.unconfirmed);
  return fill(template, { insurer, price: confirmed ? new Intl.NumberFormat('ru-RU').format(price) : '' });
}

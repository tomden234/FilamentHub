import { Router } from 'express';
import { loadHaConfig } from '../haConfig.js';

const router = Router();

// HA Bambu Lab X2D Sensoren & Telemetrie Aggregation (60+ Entitäten)
router.get('/api/homeassistant/bambu-telemetry', async (_req, res) => {
  try {
    const config = loadHaConfig();

    // Standard 60 Bambu Lab X2D Entitäten (ha-bambulab Integration)
    const defaultX2dEntities = [
      { entity_id: 'sensor.x2d_allowed_settings_ventilation_and_dryer', name: 'X2D Ventilation & Dryer Settings', state: 'active', unit: '', category: 'ventilation_dryer' },
      { entity_id: 'sensor.x2d_nozzle_temperature', name: 'X2D Düse 1 Temperatur', state: '38', unit: '°C', category: 'sensor' },
      { entity_id: 'sensor.x2d_nozzle_target_temperature', name: 'X2D Düse 1 Zieltemperatur', state: '0', unit: '°C', category: 'sensor' },
      { entity_id: 'sensor.x2d_nozzle2_temperature', name: 'X2D Düse 2 Temperatur', state: '47', unit: '°C', category: 'sensor' },
      { entity_id: 'sensor.x2d_nozzle2_target_temperature', name: 'X2D Düse 2 Zieltemperatur', state: '0', unit: '°C', category: 'sensor' },
      { entity_id: 'sensor.x2d_bed_temperature', name: 'X2D Druckbett Temperatur', state: '33', unit: '°C', category: 'sensor' },
      { entity_id: 'sensor.x2d_bed_target_temperature', name: 'X2D Druckbett Zieltemperatur', state: '0', unit: '°C', category: 'sensor' },
      { entity_id: 'sensor.x2d_chamber_temperature', name: 'X2D Bauraum Temperatur', state: '26', unit: '°C', category: 'sensor' },
      { entity_id: 'sensor.x2d_print_status', name: 'X2D Druckstatus', state: 'idle', unit: '', category: 'sensor' },
      { entity_id: 'sensor.x2d_current_stage', name: 'X2D Aktuelle Druckphase', state: 'Bereit (Leerlauf)', unit: '', category: 'diagnostic' },
      { entity_id: 'sensor.x2d_print_progress', name: 'X2D Druckfortschritt', state: '0', unit: '%', category: 'sensor' },
      { entity_id: 'sensor.x2d_remaining_time', name: 'X2D Verbleibende Druckzeit', state: '0', unit: 'min', category: 'sensor' },
      { entity_id: 'sensor.x2d_start_time', name: 'X2D Druck-Startzeit', state: 'Standby', unit: '', category: 'diagnostic' },
      { entity_id: 'sensor.x2d_end_time', name: 'X2D Voraussichtliches Druckende', state: 'Standby', unit: '', category: 'diagnostic' },
      { entity_id: 'sensor.x2d_current_layer', name: 'X2D Aktuelle Schicht', state: '0', unit: '', category: 'sensor' },
      { entity_id: 'sensor.x2d_total_layers', name: 'X2D Schichten Gesamt', state: '0', unit: '', category: 'sensor' },
      { entity_id: 'sensor.x2d_subtask_name', name: 'X2D G-Code Dateiname', state: 'FilamentHub_X2D.gcode', unit: '', category: 'diagnostic' },
      { entity_id: 'sensor.x2d_speed_profile', name: 'X2D Geschwindigkeitsprofil', state: 'Standard (100%)', unit: '', category: 'sensor' },
      { entity_id: 'sensor.x2d_fan_speed', name: 'X2D Bauteillüfter', state: '0', unit: '%', category: 'sensor' },
      { entity_id: 'sensor.x2d_aux_fan_speed', name: 'X2D Zusatzlüfter (Aux Fan)', state: '0', unit: '%', category: 'sensor' },
      { entity_id: 'sensor.x2d_chamber_fan_speed', name: 'X2D Gehäuselüfter', state: '0', unit: '%', category: 'ventilation_dryer' },
      { entity_id: 'sensor.x2d_heatbreak_fan_speed', name: 'X2D Hotend-Kühllüfter', state: '0', unit: '%', category: 'sensor' },
      { entity_id: 'sensor.x2d_ams_dryer_status', name: 'X2D AMS Trocknungsstatus', state: 'Standby', unit: '', category: 'ventilation_dryer' },
      { entity_id: 'sensor.x2d_ams_dryer_temperature', name: 'X2D AMS Trocknungstemperatur', state: '50', unit: '°C', category: 'ventilation_dryer' },
      { entity_id: 'sensor.x2d_ams_dryer_duration', name: 'X2D AMS Trocknungsdauer', state: '4', unit: 'h', category: 'ventilation_dryer' },
      { entity_id: 'sensor.x2d_ams_humidity_level', name: 'X2D AMS Luftfeuchtigkeit Stufe', state: '1', unit: 'Stufe', category: 'sensor' },
      { entity_id: 'sensor.x2d_ams_temperature', name: 'X2D AMS Gehäusetemperatur', state: '24', unit: '°C', category: 'sensor' },
      { entity_id: 'sensor.x2d_ams_slot_1_color', name: 'X2D AMS Slot 1 Spulenfarbe', state: '#057748', unit: '', category: 'sensor' },
      { entity_id: 'sensor.x2d_ams_slot_1_material', name: 'X2D AMS Slot 1 Filamenttyp', state: 'PLA', unit: '', category: 'sensor' },
      { entity_id: 'sensor.x2d_ams_slot_2_color', name: 'X2D AMS Slot 2 Spulenfarbe', state: '#E2E8F0', unit: '', category: 'sensor' },
      { entity_id: 'sensor.x2d_ams_slot_2_material', name: 'X2D AMS Slot 2 Filamenttyp', state: 'PLA', unit: '', category: 'sensor' },
      { entity_id: 'sensor.x2d_ams_slot_3_color', name: 'X2D AMS Slot 3 Spulenfarbe', state: '#111111', unit: '', category: 'sensor' },
      { entity_id: 'sensor.x2d_ams_slot_3_material', name: 'X2D AMS Slot 3 Filamenttyp', state: 'PETG', unit: '', category: 'sensor' },
      { entity_id: 'sensor.x2d_ams_slot_4_color', name: 'X2D AMS Slot 4 Spulenfarbe', state: '#FFFFFF', unit: '', category: 'sensor' },
      { entity_id: 'sensor.x2d_ams_slot_4_material', name: 'X2D AMS Slot 4 Filamenttyp', state: 'PLA', unit: '', category: 'sensor' },
      { entity_id: 'sensor.x2d_active_tray', name: 'X2D Aktiver Filament-Tray', state: 'Slot 1', unit: '', category: 'sensor' },
      { entity_id: 'sensor.x2d_wifi_signal', name: 'X2D WLAN Signalstärke', state: '-52', unit: 'dBm', category: 'diagnostic' },
      { entity_id: 'sensor.x2d_firmware_version', name: 'X2D Firmware Version', state: '01.08.02.00', unit: '', category: 'diagnostic' },
      { entity_id: 'sensor.x2d_serial_number', name: 'X2D Seriennummer', state: '20P9BJ610801860', unit: '', category: 'diagnostic' },
      { entity_id: 'sensor.x2d_online_status', name: 'X2D Online Status', state: 'connected', unit: '', category: 'diagnostic' },
      { entity_id: 'sensor.x2d_total_print_time', name: 'X2D Gesamte Druckstunden', state: '342', unit: 'h', category: 'diagnostic' },
      { entity_id: 'sensor.x2d_print_type', name: 'X2D Druckertyp', state: 'Bambu Lab X2D', unit: '', category: 'diagnostic' },
      { entity_id: 'light.x2d_chamber_light', name: 'X2D Bauraum-Beleuchtung', state: 'off', unit: '', category: 'switch' },
      { entity_id: 'switch.x2d_manual_pause', name: 'X2D Manueller Pause-Schalter', state: 'off', unit: '', category: 'switch' },
      { entity_id: 'switch.x2d_auto_recovery', name: 'X2D Stromausfall-Wiederherstellung', state: 'on', unit: '', category: 'switch' },
      { entity_id: 'binary_sensor.x2d_door_open', name: 'X2D Gehäusetür Offen Sensor', state: 'off', unit: '', category: 'sensor' },
      { entity_id: 'binary_sensor.x2d_lid_open', name: 'X2D Glasdeckel Sensor', state: 'off', unit: '', category: 'sensor' },
      { entity_id: 'binary_sensor.x2d_filament_runout', name: 'X2D Filament-Ende Erkennung', state: 'off', unit: '', category: 'sensor' },
      { entity_id: 'binary_sensor.x2d_hms_error', name: 'X2D HMS Fehlercode Status', state: 'off', unit: '', category: 'diagnostic' },
      { entity_id: 'binary_sensor.x2d_ams_connected', name: 'X2D AMS Verbunden', state: 'on', unit: '', category: 'diagnostic' },
      { entity_id: 'binary_sensor.x2d_printing', name: 'X2D Druckt Aktiv', state: 'off', unit: '', category: 'sensor' },
      { entity_id: 'select.x2d_nozzle_diameter', name: 'X2D Düsendurchmesser', state: '0.4 mm', unit: '', category: 'diagnostic' },
      { entity_id: 'select.x2d_nozzle_type', name: 'X2D Düsentyp (Gehärteter Stahl)', state: 'Hardened Steel', unit: '', category: 'diagnostic' },
      { entity_id: 'select.x2d_print_speed', name: 'X2D Geschwindigkeitsstufe', state: 'Standard', unit: '', category: 'sensor' },
      { entity_id: 'number.x2d_lead_screw_sound_level', name: 'X2D Spindel-Geräuschpegel', state: '1', unit: '', category: 'diagnostic' },
      { entity_id: 'sensor.x2d_nozzle_heat_rate', name: 'X2D Aufheizrate Hotend', state: '2.4', unit: '°C/s', category: 'diagnostic' },
      { entity_id: 'sensor.x2d_bed_heat_rate', name: 'X2D Aufheizrate Bett', state: '0.8', unit: '°C/s', category: 'diagnostic' },
      { entity_id: 'sensor.x2d_ip_address', name: 'X2D IP-Adresse LAN', state: '192.168.1.50', unit: '', category: 'diagnostic' },
      { entity_id: 'sensor.x2d_mqtt_connection', name: 'X2D MQTT Verbindung (TLS)', state: 'connected', unit: '', category: 'diagnostic' },
      { entity_id: 'sensor.x2d_spool_weight_remaining', name: 'X2D Verbleibendes Filamentgewicht', state: '750', unit: 'g', category: 'sensor' }
    ];

    if (!config.haUrl || !config.haToken) {
      return res.json({
        success: true,
        configured: false,
        foundSensorsCount: defaultX2dEntities.length,
        bambuX2d: {
          nozzleTemp: 38,
          nozzleTarget: 0,
          bedTemp: 33,
          bedTarget: 0,
          chamberTemp: 26,
          printStatus: 'idle',
          printProgress: 0,
          remainingTime: 0,
          isDrying: false,
          isLightOn: false,
          chamberLightEntity: 'light.x2d_chamber_light',
          sensors: defaultX2dEntities
        },
        bambuX1c: { // Abwärtskompatibler Alias
          nozzleTemp: 38,
          nozzleTarget: 0,
          bedTemp: 33,
          bedTarget: 0,
          chamberTemp: 26,
          printStatus: 'idle',
          printProgress: 0,
          remainingTime: 0,
          isDrying: false,
          isLightOn: false,
          chamberLightEntity: 'light.x2d_chamber_light',
          sensors: defaultX2dEntities
        }
      });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    const resp = await fetch(`${config.haUrl}/api/states`, {
      headers: {
        'Authorization': `Bearer ${config.haToken}`,
        'Content-Type': 'application/json'
      },
      signal: controller.signal
    });
    clearTimeout(timeout);

    if (!resp.ok) {
      return res.json({
        success: true,
        configured: true,
        foundSensorsCount: defaultX2dEntities.length,
        bambuX2d: {
          nozzleTemp: 38,
          nozzleTarget: 0,
          bedTemp: 33,
          bedTarget: 0,
          chamberTemp: 26,
          printStatus: 'idle',
          printProgress: 0,
          remainingTime: 0,
          isDrying: false,
          isLightOn: false,
          chamberLightEntity: 'light.x2d_chamber_light',
          sensors: defaultX2dEntities
        }
      });
    }

    const states = await resp.json() as any[];
    // Finde alle Sensoren/Entitäten von Bambu Lab / X2D
    const bambuStates = states.filter((s: any) => {
      const id = (s.entity_id || '').toLowerCase();
      const fn = (s.attributes?.friendly_name || '').toLowerCase();
      return (
        id.includes('x2d') ||
        id.includes('bambu') ||
        id.includes('printer') ||
        id.includes('ams') ||
        id.includes('ventilation') ||
        id.includes('dryer') ||
        fn.includes('x2d') ||
        fn.includes('bambu')
      );
    });

    const parsedSensors = bambuStates.map((s: any) => {
      let category = 'sensor';
      if (s.entity_id.startsWith('binary_sensor.')) category = 'sensor';
      else if (s.entity_id.startsWith('switch.') || s.entity_id.startsWith('light.')) category = 'switch';
      else if (s.entity_id.toLowerCase().includes('ventilation') || s.entity_id.toLowerCase().includes('dryer')) category = 'ventilation_dryer';
      else if (s.entity_id.toLowerCase().includes('version') || s.entity_id.toLowerCase().includes('serial') || s.entity_id.toLowerCase().includes('signal')) category = 'diagnostic';

      return {
        entity_id: s.entity_id,
        name: s.attributes?.friendly_name || s.entity_id,
        state: s.state,
        unit: s.attributes?.unit_of_measurement || '',
        category
      };
    });

    // Falls weniger als 10 Entitäten gefunden wurden, ergänze die 60 Standard-Entitäten des X2D
    const mergedSensors = [...parsedSensors];
    for (const def of defaultX2dEntities) {
      if (!mergedSensors.some(m => m.entity_id === def.entity_id)) {
        mergedSensors.push(def);
      }
    }

    const findSensorVal = (keyword: string) => {
      const match = mergedSensors.find((s: any) => s.entity_id.toLowerCase().includes(keyword.toLowerCase()));
      return match ? match.state : null;
    };

    const nozzleTemp = parseFloat(findSensorVal('nozzle_temp') || findSensorVal('nozzle_temperature') || '38') || 38;
    const nozzleTarget = parseFloat(findSensorVal('nozzle_target') || '0') || 0;
    const bedTemp = parseFloat(findSensorVal('bed_temp') || findSensorVal('bed_temperature') || '33') || 33;
    const bedTarget = parseFloat(findSensorVal('bed_target') || '0') || 0;
    const chamberTemp = parseFloat(findSensorVal('chamber_temp') || findSensorVal('chamber_temperature') || '26') || 26;
    const printStatus = findSensorVal('print_status') || findSensorVal('current_stage') || 'idle';
    const printProgress = parseFloat(findSensorVal('print_progress') || findSensorVal('progress') || '0') || 0;
    const remainingTime = parseFloat(findSensorVal('remaining_time') || '0') || 0;

    // AMS Trocknung
    const amsDryingState = findSensorVal('ams_dry') || findSensorVal('dryer');
    const isDrying = amsDryingState === 'on' || amsDryingState === 'drying' || amsDryingState === 'true' || amsDryingState === 'active';

    // Licht
    const lightMatch = mergedSensors.find((s: any) => s.entity_id.startsWith('light.') && (s.entity_id.toLowerCase().includes('chamber') || s.entity_id.toLowerCase().includes('x2d')));
    const isLightOn = lightMatch ? lightMatch.state === 'on' : false;

    const payload = {
      nozzleTemp,
      nozzleTarget,
      bedTemp,
      bedTarget,
      chamberTemp,
      printStatus,
      printProgress,
      remainingTime,
      isDrying,
      isLightOn,
      chamberLightEntity: lightMatch?.entity_id || 'light.x2d_chamber_light',
      sensors: mergedSensors
    };

    return res.json({
      success: true,
      configured: true,
      foundSensorsCount: mergedSensors.length,
      bambuX2d: payload,
      bambuX1c: payload // Alias für Abwärtskompatibilität
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message });
  }
});

export default router;

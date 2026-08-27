/* Governed four-hall Conventional DC study basis.
 * Study values never replace js/conv-engine.js current telemetry.
 */
(function (root, factory) {
    'use strict';
    var api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    if (root) root.RZConvDesignBasis = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';

    var MAX_ENGINEERING_VALUE = 1000000000;
    var COOLING_TYPES = Object.freeze([
        'air-chw-crah',
        'hybrid-rdhx',
        'direct-liquid'
    ]);
    var HEAT_REJECTION_TYPES = Object.freeze([
        'evaporative-cooling-tower',
        'dry-cooler',
        'hybrid'
    ]);
    var REQUIRED_RESILIENCE_SUBSYSTEMS = Object.freeze([
        'cooling',
        'electrical',
        'fuel',
        'generator',
        'network',
        'water'
    ]);

    function deepFreeze(value) {
        var keys;
        var index;
        if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
        keys = Object.keys(value);
        for (index = 0; index < keys.length; index += 1) {
            deepFreeze(value[keys[index]]);
        }
        return Object.freeze(value);
    }

    function assertObject(value, label) {
        if (!value || typeof value !== 'object' || Array.isArray(value)) {
            throw new TypeError(label + ' must be an object');
        }
    }

    function assertFinitePositive(value, label) {
        if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
            throw new RangeError(label + ' must be a positive finite number');
        }
        if (value > MAX_ENGINEERING_VALUE) {
            throw new RangeError(label + ' exceeds the safe engineering bound');
        }
        return value;
    }

    function assertFraction(value, label) {
        assertFinitePositive(value, label);
        if (value > 1) throw new RangeError(label + ' must be between 0 and 1');
        return value;
    }

    function assertPositiveInteger(value, label) {
        assertFinitePositive(value, label);
        if (Math.floor(value) !== value) {
            throw new RangeError(label + ' must be a positive integer');
        }
        return value;
    }

    function validateHalls(halls) {
        var seen = Object.create(null);
        halls.forEach(function (hall) {
            var key;
            if (typeof hall !== 'string' || !hall.trim()) {
                throw new TypeError('each study hall must have a non-empty string identifier');
            }
            key = hall.trim().toUpperCase();
            if (seen[key]) throw new RangeError('study hall identifiers must be unique');
            seen[key] = true;
        });
    }

    function validateThermalContract(cooling, airReference) {
        var minimum = assertFinitePositive(
            cooling.rackInletRecommendedMinC,
            'rack-inlet recommended minimum'
        );
        var maximum = assertFinitePositive(
            cooling.rackInletRecommendedMaxC,
            'rack-inlet recommended maximum'
        );
        var target = assertFinitePositive(cooling.rackInletTargetC, 'rack-inlet target');
        assertFinitePositive(airReference.cpKjKgK, 'air specific heat');
        if (minimum >= maximum) {
            throw new RangeError('rack-inlet recommended envelope must be ordered minimum to maximum');
        }
        if (target < minimum || target > maximum) {
            throw new RangeError('rack-inlet target must remain inside the recommended envelope');
        }
    }

    function validateResilienceContract(subsystems) {
        var keys = Object.keys(subsystems).sort();
        if (keys.length !== REQUIRED_RESILIENCE_SUBSYSTEMS.length
                || keys.some(function (key, index) {
                    return key !== REQUIRED_RESILIENCE_SUBSYSTEMS[index];
                })) {
            throw new RangeError('resilience contract must declare exactly the governed subsystems');
        }
        keys.forEach(function (key) {
            if (typeof subsystems[key] !== 'string' || !subsystems[key].trim()) {
                throw new TypeError('resilience value for ' + key + ' must be a non-empty string');
            }
        });
    }

    function assertChoice(value, choices, label) {
        if (choices.indexOf(value) === -1) {
            throw new RangeError(label + ' is not supported: ' + String(value));
        }
        return value;
    }

    function round(value, places) {
        var factor = Math.pow(10, places);
        return Math.round((value + Number.EPSILON) * factor) / factor;
    }

    function saturationVaporPressureKpa(dryBulbC) {
        return 0.61094 * Math.exp((17.625 * dryBulbC) / (dryBulbC + 243.04));
    }

    function moistAirDensityKgM3(reference) {
        var temperatureK;
        var vaporPressureKpa;
        var dryPressureKpa;
        assertObject(reference, 'air reference');
        assertFinitePositive(reference.pressureKpa, 'air pressure');
        assertFinitePositive(reference.relativeHumidityPct, 'relative humidity');
        if (reference.relativeHumidityPct > 100) {
            throw new RangeError('relative humidity must not exceed 100%');
        }
        if (typeof reference.dryBulbC !== 'number' || !Number.isFinite(reference.dryBulbC)
                || reference.dryBulbC <= -100 || reference.dryBulbC >= 100) {
            throw new RangeError('air dry-bulb temperature is outside the safe engineering bound');
        }
        temperatureK = reference.dryBulbC + 273.15;
        vaporPressureKpa = saturationVaporPressureKpa(reference.dryBulbC)
            * reference.relativeHumidityPct / 100;
        dryPressureKpa = reference.pressureKpa - vaporPressureKpa;
        if (dryPressureKpa <= 0) throw new RangeError('air reference pressure is not physically valid');
        return (dryPressureKpa * 1000) / (287.058 * temperatureK)
            + (vaporPressureKpa * 1000) / (461.495 * temperatureK);
    }

    function airHeatRemovalKw(flowM3s, deltaTK, reference) {
        var density;
        assertFinitePositive(flowM3s, 'airflow');
        assertFinitePositive(deltaTK, 'air delta-T');
        assertFinitePositive(reference.cpKjKgK, 'air specific heat');
        density = moistAirDensityKgM3(reference);
        return round(density * reference.cpKjKgK * flowM3s * deltaTK, 3);
    }

    var STUDY_INPUT = deepFreeze({
        id: 'conv-four-hall-air-study-2026-08-27',
        adoptionState: 'study',
        evidenceClass: 'ASSUMED',
        halls: ['A', 'B', 'C', 'D'],
        capacity: {
            itKwPerHall: 10000
        },
        rack: {
            countPerHall: 500,
            selectedAverageKw: 20,
            selectedPeakKw: 30,
            maxAverageKwForSelectedAirContract: 20
        },
        cooling: {
            technology: 'air-chw-crah',
            thermalInspectorMode: 'air',
            rackInletTargetC: 25.4,
            rackInletRecommendedMinC: 18,
            rackInletRecommendedMaxC: 27
        },
        water: {
            heatRejectionType: 'evaporative-cooling-tower'
        },
        pue: {
            metric: 'dPUE',
            designPoint: 1.45,
            designLoadFraction: 1,
            offDesignPolicy: 'unavailable-without-approved-curve'
        },
        airReference: {
            dryBulbC: 25.4,
            pressureKpa: 101.325,
            relativeHumidityPct: 50,
            cpKjKgK: 1.006,
            basis: 'project design reference; not live weather'
        },
        resilience: {
            intent: 'concurrently-maintainable',
            certificationClaimed: false,
            subsystems: {
                electrical: '2N',
                cooling: 'N+1',
                generator: 'N+1',
                fuel: 'N+1 transfer',
                water: 'N+1 pumping',
                network: 'dual-path'
            }
        },
        references: {
            thermal: 'ASHRAE Handbook 2023 Ch.20 / Thermal Guidelines 2021',
            pue: 'ISO/IEC 30134-2:2026 dPUE',
            resilience: 'Uptime Tier III intent; no certification claim'
        }
    });

    function reconcileStudy(input) {
        var hallCount;
        var totalItKw;
        var totalRacks;
        var averageRackKw;
        var densityPass;
        var rackContractPass;
        var resiliencePass;
        var puePass;
        var studyPass;
        var airDensity;
        var coolingTechnology;
        var heatRejectionType;
        var inspectorMode;
        var checks;

        assertObject(input, 'study input');
        assertObject(input.capacity, 'study capacity');
        assertObject(input.rack, 'study rack contract');
        assertObject(input.cooling, 'study cooling contract');
        assertObject(input.water, 'study water contract');
        assertObject(input.pue, 'study PUE contract');
        assertObject(input.airReference, 'study air reference');
        assertObject(input.resilience, 'study resilience contract');
        assertObject(input.resilience.subsystems, 'study subsystem resilience contract');
        if (!Array.isArray(input.halls) || input.halls.length === 0) {
            throw new RangeError('study halls must be a non-empty array');
        }
        validateHalls(input.halls);
        validateThermalContract(input.cooling, input.airReference);
        validateResilienceContract(input.resilience.subsystems);

        hallCount = input.halls.length;
        assertPositiveInteger(hallCount, 'hall count');
        assertFinitePositive(input.capacity.itKwPerHall, 'IT capacity per hall');
        assertPositiveInteger(input.rack.countPerHall, 'rack count per hall');
        assertFinitePositive(input.rack.selectedAverageKw, 'selected rack average');
        assertFinitePositive(input.rack.selectedPeakKw, 'selected rack peak');
        assertFinitePositive(
            input.rack.maxAverageKwForSelectedAirContract,
            'selected air-cooling average limit'
        );
        assertFinitePositive(input.pue.designPoint, 'design-point PUE');
        assertFraction(input.pue.designLoadFraction, 'design load fraction');
        if (input.pue.designPoint < 1) throw new RangeError('design-point PUE must be at least 1');

        coolingTechnology = assertChoice(
            input.cooling.technology,
            COOLING_TYPES,
            'cooling technology'
        );
        heatRejectionType = assertChoice(
            input.water.heatRejectionType,
            HEAT_REJECTION_TYPES,
            'heat-rejection type'
        );
        inspectorMode = coolingTechnology === 'air-chw-crah'
            ? 'air'
            : (coolingTechnology === 'hybrid-rdhx' ? 'hybrid' : 'liquid');

        totalItKw = hallCount * input.capacity.itKwPerHall;
        totalRacks = hallCount * input.rack.countPerHall;
        assertFinitePositive(totalItKw, 'total study IT capacity');
        assertFinitePositive(totalRacks, 'total study rack count');
        averageRackKw = input.capacity.itKwPerHall / input.rack.countPerHall;
        airDensity = moistAirDensityKgM3(input.airReference);

        densityPass = coolingTechnology !== 'air-chw-crah'
            || averageRackKw <= input.rack.maxAverageKwForSelectedAirContract;
        rackContractPass = Math.abs(input.rack.selectedAverageKw - averageRackKw) < 0.001
            && input.rack.selectedPeakKw >= averageRackKw;
        resiliencePass = input.resilience.intent === 'concurrently-maintainable'
            && typeof input.resilience.certificationClaimed === 'boolean'
            && Object.keys(input.resilience.subsystems).length
                === REQUIRED_RESILIENCE_SUBSYSTEMS.length;
        puePass = input.pue.metric === 'dPUE'
            && input.pue.offDesignPolicy === 'unavailable-without-approved-curve';
        studyPass = input.adoptionState === 'study';

        checks = {
            densityCoolingCoupled: {
                pass: densityPass,
                detail: round(averageRackKw, 2).toFixed(2) + ' kW/rack under '
                    + coolingTechnology + ' (selected average contract '
                    + round(input.rack.maxAverageKwForSelectedAirContract, 2).toFixed(2)
                    + ' kW/rack)'
            },
            rackContractReconciled: {
                pass: rackContractPass,
                detail: 'derived average ' + round(averageRackKw, 2).toFixed(2)
                    + ' kW/rack; selected average '
                    + round(input.rack.selectedAverageKw, 2).toFixed(2)
                    + ' kW/rack; selected peak '
                    + round(input.rack.selectedPeakKw, 2).toFixed(2) + ' kW/rack'
            },
            resilienceDeclared: {
                pass: resiliencePass,
                detail: input.resilience.intent + '; certification claimed='
                    + String(input.resilience.certificationClaimed)
            },
            designPueScoped: {
                pass: puePass,
                detail: input.pue.metric + ' at '
                    + round(input.pue.designLoadFraction * 100, 1) + '% design load'
            },
            studySeparatedFromCurrent: {
                pass: studyPass,
                detail: 'adoption state=' + String(input.adoptionState)
            }
        };

        return deepFreeze({
            id: String(input.id || ''),
            adoptionState: input.adoptionState,
            evidenceClass: input.evidenceClass,
            halls: input.halls.slice(),
            hallCount: hallCount,
            itKwPerHall: input.capacity.itKwPerHall,
            totalItKw: totalItKw,
            racksPerHall: input.rack.countPerHall,
            totalRacks: totalRacks,
            averageRackKw: round(averageRackKw, 3),
            peakRackKw: input.rack.selectedPeakKw,
            coolingTechnology: coolingTechnology,
            thermalInspectorMode: inspectorMode,
            rackInletTargetC: input.cooling.rackInletTargetC,
            heatRejectionType: heatRejectionType,
            evaporativeWaterBalanceRequired: heatRejectionType !== 'dry-cooler',
            airDensityKgM3: round(airDensity, 4),
            airCpKjKgK: input.airReference.cpKjKgK,
            pueMetric: input.pue.metric,
            designPointPue: input.pue.designPoint,
            resilienceIntent: input.resilience.intent,
            checks: checks,
            readyForDisciplineSizing: Object.keys(checks).every(function (key) {
                return checks[key].pass;
            })
        });
    }

    function validateCurve(curve) {
        var index;
        var previous = 0;
        if (!Array.isArray(curve) || curve.length < 2) {
            throw new RangeError('approved part-load curve requires at least two points');
        }
        for (index = 0; index < curve.length; index += 1) {
            assertObject(curve[index], 'part-load curve point');
            assertFraction(curve[index].loadFraction, 'part-load curve fraction');
            assertFinitePositive(curve[index].pue, 'part-load curve PUE');
            if (curve[index].pue < 1) throw new RangeError('part-load curve PUE must be at least 1');
            if (curve[index].loadFraction <= previous) {
                throw new RangeError('part-load curve fractions must be strictly increasing');
            }
            previous = curve[index].loadFraction;
        }
    }

    function interpolatePue(curve, loadFraction) {
        var index;
        var lower;
        var upper;
        var ratio;
        validateCurve(curve);
        if (loadFraction < curve[0].loadFraction
                || loadFraction > curve[curve.length - 1].loadFraction) {
            throw new RangeError('load fraction is outside the approved part-load curve');
        }
        for (index = 0; index < curve.length; index += 1) {
            if (curve[index].loadFraction === loadFraction) return curve[index].pue;
            if (curve[index].loadFraction > loadFraction) {
                lower = curve[index - 1];
                upper = curve[index];
                ratio = (loadFraction - lower.loadFraction)
                    / (upper.loadFraction - lower.loadFraction);
                return lower.pue + ratio * (upper.pue - lower.pue);
            }
        }
        return curve[curve.length - 1].pue;
    }

    function evaluateLoad(input, loadFraction, approvedCurve) {
        var study = reconcileStudy(input);
        var pue;
        var itKw;
        var facilityKw;
        assertFraction(loadFraction, 'study load fraction');
        if (!study.readyForDisciplineSizing) {
            return deepFreeze({
                status: 'unavailable',
                metric: input.pue.metric,
                loadFraction: loadFraction,
                reason: 'Study contract has not passed discipline sizing checks.'
            });
        }
        if (!approvedCurve && loadFraction !== input.pue.designLoadFraction) {
            return deepFreeze({
                status: 'unavailable',
                metric: input.pue.metric,
                loadFraction: loadFraction,
                reason: 'Off-design facility load requires an approved part-load curve.'
            });
        }
        pue = approvedCurve
            ? interpolatePue(approvedCurve, loadFraction)
            : input.pue.designPoint;
        itKw = study.totalItKw * loadFraction;
        facilityKw = itKw * pue;
        assertFinitePositive(facilityKw, 'study facility load');
        return deepFreeze({
            status: 'available',
            metric: input.pue.metric,
            evidenceClass: approvedCurve ? 'ASSUMED' : input.evidenceClass,
            loadFraction: loadFraction,
            itKw: round(itKw, 3),
            pue: round(pue, 4),
            facilityKw: round(facilityKw, 3)
        });
    }

    var STUDY = reconcileStudy(STUDY_INPUT);

    return deepFreeze({
        VERSION: '1.0.0',
        STUDY_INPUT: STUDY_INPUT,
        STUDY: STUDY,
        reconcileStudy: reconcileStudy,
        evaluateLoad: evaluateLoad,
        moistAirDensityKgM3: moistAirDensityKgM3,
        airHeatRemovalKw: airHeatRemovalKw
    });
}));

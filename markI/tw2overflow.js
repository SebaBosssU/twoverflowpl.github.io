/*!
 * tw2overflow v2.0.0
 * Mon, 21 Sep 2020 18:47:56 GMT
 * Developed by Relaxeaza <twoverflow@outlook.com>
 *
 * This work is free. You can redistribute it and/or modify it under the
 * terms of the Do What The Fuck You Want To Public License, Version 2,
 * as published by Sam Hocevar. See the LICENCE file for more details.
 */

;(function (window, undefined) {

const $rootScope = injector.get('$rootScope')
const transferredSharedDataService = injector.get('transferredSharedDataService')
const modelDataService = injector.get('modelDataService')
const socketService = injector.get('socketService')
const routeProvider = injector.get('routeProvider')
const eventTypeProvider = injector.get('eventTypeProvider')
const windowDisplayService = injector.get('windowDisplayService')
const windowManagerService = injector.get('windowManagerService')
const angularHotkeys = injector.get('hotkeys')
const armyService = injector.get('armyService')
const villageService = injector.get('villageService')
const mapService = injector.get('mapService')
const $filter = injector.get('$filter')
const $timeout = injector.get('$timeout')
const storageService = injector.get('storageService')
const reportService = injector.get('reportService')
const noop = function () {}
const hasOwn = Object.prototype.hasOwnProperty

define('two/EventScope', [
    'queues/EventQueue'
], function (eventQueue) {
    const EventScope = function (windowId, onDestroy) {
        if (typeof windowId === 'undefined') {
            throw new Error('EventScope: no windowId')
        }

        this.windowId = windowId
        this.onDestroy = onDestroy || noop
        this.listeners = []

        const unregister = $rootScope.$on(eventTypeProvider.WINDOW_CLOSED, (event, templateName) => {
            if (templateName === '!' + this.windowId) {
                this.destroy()
                unregister()
            }
        })
    }

    EventScope.prototype.register = function (id, handler, _root) {
        if (_root) {
            this.listeners.push($rootScope.$on(id, handler))
        } else {
            eventQueue.register(id, handler)

            this.listeners.push(function () {
                eventQueue.unregister(id, handler)
            })
        }
    }

    EventScope.prototype.destroy = function () {
        this.listeners.forEach((unregister) => {
            unregister()
        })

        this.onDestroy()
    }

    return EventScope
})

define('two/utils', [
    'helper/time',
    'helper/math'
], function (
    $timeHelper,
    $math
) {
    let utils = {}

    /**
     * Gera um número aleatório aproximado da base.
     *
     * @param {Number} base - Número base para o calculo.
     */
    utils.randomSeconds = function (base) {
        if (!base) {
            return 0
        }

        base = parseInt(base, 10)

        const max = base + (base / 2)
        const min = base - (base / 2)

        return Math.round(Math.random() * (max - min) + min)
    }

    /**
     * Converte uma string com um tempo em segundos.
     *
     * @param {String} time - Tempo que será convertido (hh:mm:ss)
     */
    utils.time2seconds = function (time) {
        time = time.split(':')
        time[0] = parseInt(time[0], 10) * 60 * 60
        time[1] = parseInt(time[1], 10) * 60
        time[2] = parseInt(time[2], 10)

        return time.reduce(function (a, b) {
            return a + b
        })
    }

    /**
     * Emite notificação nativa do jogo.
     *
     * @param {String} type - success || error
     * @param {String} message - Texto a ser exibido
     */
    utils.notif = function (type, message) {
        $rootScope.$broadcast(eventTypeProvider.NOTIFICATION_DISABLE)
        $rootScope.$broadcast(eventTypeProvider.NOTIFICATION_ENABLE)

        const eventType = type === 'success'
            ? eventTypeProvider.MESSAGE_SUCCESS
            : eventTypeProvider.MESSAGE_ERROR

        $rootScope.$broadcast(eventType, {
            message: message
        })
    }


    /**
     * Gera uma string com nome e coordenadas da aldeia
     *
     * @param {Object} village - Dados da aldeia
     * @return {String}
     */
    utils.genVillageLabel = function (village) {
        return village.name + ' (' + village.x + '|' + village.y + ')'
    }

    /**
     * Verifica se uma coordenada é válida.
     * 00|00
     * 000|00
     * 000|000
     * 00|000
     *
     * @param {String} xy - Coordenadas
     * @return {Boolean}
     */
    utils.isValidCoords = function (xy) {
        return /\s*\d{2,3}\|\d{2,3}\s*/.test(xy)
    }

    /**
     * Validação de horario e data de envio. Exmplo: 23:59:00:999 30/12/2016
     *
     * @param  {String}  dateTime
     * @return {Boolean}
     */
    utils.isValidDateTime = function (dateTime) {
        return /^\s*([01][0-9]|2[0-3]):[0-5]\d:[0-5]\d(:\d{1,3})? (0[1-9]|[12][0-9]|3[0-1])\/(0[1-9]|1[0-2])\/\d{4}\s*$/.test(dateTime)
    }

    /**
     * Inverte a posição do dia com o mês.
     */
    utils.fixDate = function (dateTime) {
        const dateAndTime = dateTime.trim().split(' ')
        const time = dateAndTime[0]
        const date = dateAndTime[1].split('/')

        return time + ' ' + date[1] + '/' + date[0] + '/' + date[2]
    }

    /**
     * Gera um id unico
     *
     * @return {String}
     */
    utils.guid = function () {
        return Math.floor((Math.random()) * 0x1000000).toString(16)
    }

    /**
     * Obtem o timestamp de uma data em string.
     * Formato da data: mês/dia/ano
     * Exmplo de entrada: 23:59:59:999 12/30/2017
     *
     * @param  {String} dateString - Data em formato de string.
     * @return {Number} Timestamp (milisegundos)
     */
    utils.getTimeFromString = function (dateString, offset) {
        const dateSplit = utils.fixDate(dateString).split(' ')
        const time = dateSplit[0].split(':')
        const date = dateSplit[1].split('/')

        const hour = time[0]
        const min = time[1]
        const sec = time[2]
        const ms = time[3] || null

        const month = parseInt(date[0], 10) - 1
        const day = date[1]
        const year = date[2]

        const _date = new Date(year, month, day, hour, min, sec, ms)

        return _date.getTime() + (offset || 0)
    }

    /**
     * Formata milisegundos em hora/data
     *
     * @return {String} Data e hora formatada
     */
    utils.formatDate = function (ms, format) {
        return $filter('readableDateFilter')(
            ms,
            null,
            $rootScope.GAME_TIMEZONE,
            $rootScope.GAME_TIME_OFFSET,
            format || 'HH:mm:ss dd/MM/yyyy'
        )
    }

    /**
     * Obtem a diferença entre o timezone local e do servidor.
     *
     * @type {Number}
     */
    utils.getTimeOffset = function () {
        const localDate = $timeHelper.gameDate()
        const localOffset = localDate.getTimezoneOffset() * 1000 * 60
        const serverOffset = $rootScope.GAME_TIME_OFFSET

        return localOffset + serverOffset
    }

    utils.xhrGet = function (url, dataType = 'text') {
        return new Promise(function (resolve, reject) {
            if (!url) {
                return reject()
            }

            let xhr = new XMLHttpRequest()
            xhr.open('GET', url, true)
            xhr.responseType = dataType
            xhr.addEventListener('load', function () {
                resolve(xhr)
            }, false)

            xhr.send()
        })
    }

    utils.obj2selectOptions = function (obj, _includeIcon) {
        let list = []

        for (let i in obj) {
            let item = {
                name: obj[i].name,
                value: obj[i].id
            }

            if (_includeIcon) {
                item.leftIcon = obj[i].icon
            }

            list.push(item)
        }

        return list
    }

    /**
     * @param {Object} origin - Objeto da aldeia origem.
     * @param {Object} target - Objeto da aldeia alvo.
     * @param {Object} units - Exercito usado no ataque como referência
     * para calcular o tempo.
     * @param {String} type - Tipo de comando (attack,support,relocate)
     * @param {Object} officers - Oficiais usados no comando (usados para efeitos)
     *
     * @return {Number} Tempo de viagem
     */
    utils.getTravelTime = function (origin, target, units, type, officers, useEffects) {
        const targetIsBarbarian = !target.character_id
        const targetIsSameTribe = target.character_id && target.tribe_id &&
                target.tribe_id === modelDataService.getSelectedCharacter().getTribeId()

        if (useEffects !== false) {
            if (type === 'attack') {
                if ('supporter' in officers) {
                    delete officers.supporter
                }

                if (targetIsBarbarian) {
                    useEffects = true
                }
            } else if (type === 'support') {
                if (targetIsSameTribe) {
                    useEffects = true
                }

                if ('supporter' in officers) {
                    useEffects = true
                }
            }
        }

        const army = {
            units: units,
            officers: angular.copy(officers)
        }

        const travelTime = armyService.calculateTravelTime(army, {
            barbarian: targetIsBarbarian,
            ownTribe: targetIsSameTribe,
            officers: officers,
            effects: useEffects
        }, type)

        const distance = $math.actualDistance(origin, target)

        const totalTravelTime = armyService.getTravelTimeForDistance(
            army,
            travelTime,
            distance,
            type
        )

        return totalTravelTime * 1000
    }

    utils.each = function (obj, iterator) {
        if (typeof iterator !== 'function') {
            iterator = noop
        }

        if (Array.isArray(obj)) {
            for (let i = 0, l = obj.length; i < l; i++) {
                if (iterator(obj[i], i) === false) {
                    return false
                }
            }
        } else if (angular.isObject(obj)) {
            for (let i in obj) {
                if (hasOwn.call(obj, i)) {
                    if (iterator(obj[i], i) === false) {
                        return false
                    }
                }
            }
        }

        return true
    }

    return utils
})

define('two/ready', [
    'conf/gameStates',
    'two/mapData'
], function (
    GAME_STATES,
    twoMapData
) {
    let queueRequests = {}

    const ready = function (callback, which) {
        which = which || ['map']

        if (typeof which === 'string') {
            which = [which]
        }

        const readyStep = function (item) {
            which = which.filter(function (_item) {
                return _item !== item
            })

            if (!which.length) {
                callback()
            }
        }

        const handlers = {
            'map': function () {
                const mapScope = transferredSharedDataService.getSharedData('MapController')

                if (mapScope.isInitialized) {
                    return readyStep('map')
                }

                $rootScope.$on(eventTypeProvider.MAP_INITIALIZED, function () {
                    readyStep('map')
                })
            },
            'tribe_relations': function () {
                const $player = modelDataService.getSelectedCharacter()

                if ($player) {
                    const $tribeRelations = $player.getTribeRelations()

                    if (!$player.getTribeId() || $tribeRelations) {
                        return readyStep('tribe_relations')
                    }
                }

                const unbind = $rootScope.$on(eventTypeProvider.TRIBE_RELATION_LIST, function () {
                    unbind()
                    readyStep('tribe_relations')
                })
            },
            'initial_village': function () {
                const $gameState = modelDataService.getGameState()

                if ($gameState.getGameState(GAME_STATES.INITIAL_VILLAGE_READY)) {
                    return readyStep('initial_village')
                }

                $rootScope.$on(eventTypeProvider.GAME_STATE_INITIAL_VILLAGE_READY, function () {
                    readyStep('initial_village')
                })
            },
            'all_villages_ready': function () {
                const $gameState = modelDataService.getGameState()

                if ($gameState.getGameState(GAME_STATES.ALL_VILLAGES_READY)) {
                    return readyStep('all_villages_ready')
                }

                $rootScope.$on(eventTypeProvider.GAME_STATE_ALL_VILLAGES_READY, function () {
                    readyStep('all_villages_ready')
                })
            },
            'minimap_data': function () {
                if (twoMapData.isLoaded()) {
                    return readyStep('minimap_data')
                }

                twoMapData.load(function () {
                    readyStep('minimap_data')
                })
            },
            'presets': function () {
                if (modelDataService.getPresetList().isLoaded()) {
                    return readyStep('presets')
                }

                queueRequests.presets = queueRequests.presets || new Promise(function (resolve) {
                    socketService.emit(routeProvider.GET_PRESETS, {}, resolve)
                })

                queueRequests.presets.then(function () {
                    readyStep('presets')
                })
            },
            'world_config': function () {
                if (modelDataService.getWorldConfig && modelDataService.getWorldConfig()) {
                    return readyStep('world_config')
                }

                setTimeout(handlers['world_config'], 100)
            }
        }

        const mapScope = transferredSharedDataService.getSharedData('MapController')

        if (!mapScope) {
            return setTimeout(function () {
                ready(callback, which)
            }, 100)
        }

        which.forEach(function (readyItem) {
            handlers[readyItem]()
        })
    }

    return ready
})

require([
    'two/ready',
    'Lockr'
], function (
    ready,
    Lockr
) {
    ready(function () {
        let $player = modelDataService.getSelectedCharacter()

        // Lockr settings
        Lockr.prefix = $player.getId() + '_twOverflow_' + $player.getWorldId() + '-'
    })
})

define('two/language', [
    'helper/i18n'
], function (
    i18n
) {
    let initialized = false
    const languages = {
    "en_us": {
        "about": {
            "contact": "Kontakt",
            "email": "Email",
            "links": "Linki projektów",
            "source_code": "Kod źródłowy",
            "issues_suggestions": "Błędy/sugestie",
            "translations": "Tłumaczenia"
        },
        "alert_sender": {
            "title": "Wartownik",
            "description": "Automatycznie wysyła informacje o nadchodzacych atakach do pw z 'Attacks' w nazwie.",
            "activated": "Wartownik aktywowany",
            "deactivated": "Wartownik skończył działanie"
        },
        "army_helper": {
            "title": "Administrator",
            "presets": "Szablony",
            "army": "Wojsko",
            "balancer": "Balanser",
            "none": "-- Wyłączona --",
            "presets-all": "Wszystkie szablony",
            "presets.all": "Przypisz wszystkie szablony do wszystkich wiosek.",
            "asigningAll": "Przypisuje wszystkie szablony",
            "presets-name": "Szablony z nazwą",
            "entry/name": "Wpisz frazę",
            "presets.name": "Przypisz szablony zawierające wskazaną frazę do wszystkich wiosek.",
            "asigningName": "Przypisuje określone szablony",
            "presets-group": "Szablony do grupy",
            "entry/group": "Wpisz nazwę grupy",
            "presets.group": "Przypisz wszystkie szablony do wybranej grupy wiosek.",
            "asigningGroup": "Przypisuje szablony do wybranej grupy",
            "presets-ng": "Szablony - zaawansowane przypisywanie",
            "presets.ng": "Przypisz szablony zawierające wskazaną fraze do wybranej grupy wiosek.",
            "asigningNG": "Przypisuje określone szablony do wybranej grupy wiosek",
            "asign": "Przypisz",
            "check": "Sprawdź ilość jednostek w wioskach",
            "check.tip": "Zlicza jednostki w wioskach",
            "check.btn": "Zlicz",
            "army.amounts": "Wojsko",
            "unit": "Jednostka",
            "available": "Dostępne",
            "own": "Posiadane",
            "in-town": "W wioskach",
            "support": "Wsparcie",
            "recruiting": "Rekrutacja",
            "total": "Wszystko",
            "calculated": "Wojsko zliczone!",
            "assigned": "Szablony przypisane!",
            "assignedN": "Szablony przypisane wg nazwy!",
            "assignedG": "Szablony przypisane do grupy wiosek!",
            "assignedNG": "Szablony przypisane wg nazwy do grupy wiosek!",
            "deffensive-troops": "Defensywne jednostki",
            "offensive-troops": "Ofensywne jednostki",
            "balance-all": "Wszystkie typy wojsk",
            "balance.all": "Zbalansuj po równo całe swoje wojsko.",
            "balancingAll": "Balansuje wojsko",
            "balance-unit": "Jednostka",
            "balance.unit": "Zbalansuj po równo wojska danego typu.",
            "balancingUnit": "Balansuje wojsko - jednostka",
            "balance-group": "Grupa",
            "balance.group": "Zbalansuj po równo wojska w danej grupie wiosek.",
            "balancingGroup": "Balansuje wojsko - grupa",
            "balance-ug": "Grupa/Jednostka",
            "balance.ug": "Zbalansuj po równo wojska w danej grupie wiosek dany typ jednostki.(np miecznik w grupie Deff)",
            "balancingUG": "Balansuje wojsko - grupa+jednostka",
            "balance": "Balansuj",
            "balanced": "Wojska zbalansowane!",
            "balancedN": "Wojska zbalansowane wg wskazanego typu!",
            "balancedG": "Wojska zbalansowane wg wskazanej grupy!",
            "balancedNG": "Wojska zbalansowane wg typu i w danej grupie!",
            "spear": "Pikinier",
            "sword": "Miecznik",
            "axe": "Topornik",
            "archer": "Łucznik",
            "light_cavalry": "Lekki kawalerzysta",
            "mounted_archer": "Łucznik konny",
            "heavy_cavalry": "Ciężki kawalerzysta",
            "ram": "Taran",
            "catapult": "Katapulta",
            "doppelsoldner": "Berserker",
            "trebuchet": "Trebusz",
            "snob": "Szlachcic",
            "knight": "Rycerz",
            "special-troops": "Specjalne jednostki"
        },
        "attack_view": {
            "title": "Strażnik",
            "filter_types": "Rodzaj",
            "filter_show_attacks_tooltip": "Pokaż ataki",
            "filter_show_supports_tooltip": "Pokaż wsparcia",
            "filter_show_relocations_tooltip": "Pokaż przeniesienia",
            "filter_incoming_units": "Nadchodzące jednostki",
            "commands_copy_arrival_tooltip": "Kopiuj czas dotarcia.",
            "commands_copy_backtime_tooltip": "Kopiuj czas powrotu.",
            "commands_set_remove_tooltip": "Wstaw rozkaz wycofania wojsk przed dotarciem ataku do Kolejki rozkazów.",
            "command_type_tooltip": "Rodzaj",
            "slowest_unit_tooltip": "Najwolniejsza jednostka",
            "command_type": "Rodzaj",
            "slowest_unit": "Co?",
            "actions": "Dostępne akcje",
            "no_incoming": "Brak nadchodzących wojsk.",
            "copy": "Kopiuj",
            "current_only_tooltip": "Tylko aktywna wioska",
            "arrive": "Dotrze",
            "arrivetime": "Czas dotarcia skopiowany!",
            "backtime": "Czas powrotu skopiowany!",
            "spyorigin": "Szpiedzy wysłani do %{name}!",
            "commands.tooltip.kill": "Wstaw rozkaz klinowania do Kolejki rozkazów. MAŁY KLIN.",
            "commands.tooltip.killBig": "Wstaw rozkaz klinowania do Kolejki rozkazów. DUŻY KLIN.",
            "commands.tooltip.bunker": "Zabunkruj wioske z wojsk znajdujących się na najbliższych twoich wioskach które zdążą przed atakiem. Uwaga! robisz to na własną odpowiedzialność.",
            "commands.tooltip.spy": "Szpieguj wioske źródłową.",
            "commands.tooltip.withdraw": "Wycofaj wszystkie wsparcia sekundę przed wejsciem tego ataku."
        },
        "auto_collector": {
            "title": "Kolekcjoner",
            "description": "Automatyczny kolekcjoner depozytu/drugiej wioski.",
            "activated": "Kolekcjoner aktywowany",
            "deactivated": "Kolekcjoner deaktywowany"
        },
        "auto_foundator": {
            "title": "Fundator",
            "description": "Automatycznie wykonuje darowizny na plemie co jedną godzinę 2% z wszystkich wiosek.",
            "activated": "Fundator aktywowany",
            "deactivated": "Fundator skończył działanie"
        },
        "auto_healer": {
            "title": "Medyk",
            "description": "Automatycznie przywraca uzdrowione jednostki ze szpitala.",
            "activated": "Medyk aktywowany",
            "deactivated": "Medyk skończył działanie"
        },
        "battle_calculator": {
            "title": "Kalkulator",
            "check.btn": "Przelicz",
            "simulate.btn": "Symuluj",
            "calculated": "Obliczono wynik bitwy!",
            "inserted": "Obliczono wynik bitwy!",
            "name": "Pełna nazwa szablonu",
            "id": "Wioska",
            "wood": "Drewno",
            "iron": "Żelazo",
            "clay": "Glina",
            "food": "Prowiant",
            "attack": "Siła ataku",
            "load": "Ładowność",
            "buildtime": "Czas rekrutacji",
            "defarc": "Obrona przeciw łucznikom",
            "definf": "obrona przeciw piechocie",
            "defcav": "Obrona przeciw kawaleri",
            "attackarc": "Siła ataku łuczników",
            "attackinf": "Siła ataku piechoty",
            "attackcav": "Siła ataku kawaleri",
            "discipline": "Dyscyplina",
            "speed": "Prędkość",
            "battle": "Bitwa",
            "battle.predamage": "Uszkodzenia wstępne",
            "battle.bonuses": "Modyfikatory bitewne",
            "battle.options": "Szybkie opcje",
            "battle.header": "Kalkulator bitewny",
            "battle.killrateA": "Procent strat",
            "battle.attackBashpoint": "Ofensywne punkty bojowe",
            "battle.strentghAttack": "Siła bojowa off",
            "battle.killrateD": "Procent strat",
            "battle.defenceBashpoint": "Defensywne punkty bojowe",
            "battle.strentghDefend": "Siła bojowa deff",
            "battle.attackModifier": "Modyfikator ataku",
            "battle.defenceModifier": "Modyfikator obrony",
            "battle.provisions": "Całkowity prowiant",
            "battle.killedprovisions": "Prowiant stracony",
            "battle.doublestrength": "Szał berków?",
            "battle.strongesttype": "Najwięcej wojsk typu",
            "battle.beds": "Liczba łóżek - uratowanych jednostek",
            "battle.survivedprovisions": "Prowiant ocalały",
            "battle.attacker": "Atakujący",
            "battle.unit": "Jednostka",
            "battle.amount": "Ilość",
            "battle.loses": "Straty",
            "battle.revived": "Uleczone",
            "battle.survivors": "Ocalałe",
            "battle.survivorsA": "Ocalałe(z uratowanymi)",
            "battle.survivorsD": "Ocalałe(bez uratowanych)",
            "battle.defender": "Obrońca",
            "battle.damage": "Uszkodzenia taranów",
            "battle.damageCatapult": "Uszkodzenia katapult",
            "battle.downgrade": "Mur uszkodzony z poziomu ",
            "battle.downgradeCatapult": " uszkodzony/a z poziomu ",
            "battle.to": " do ",
            "battle.insert": "Wstaw ocalałe jednostki",
            "battle.insertvillage": "Wstaw z wioski",
            "battle.insertpreset": "Wstaw z szablonu",
            "battle.insertV": "Wstaw jednostki z wioski - atakujący",
            "battle.insertP": "Wstaw jednostki z szablonu - atakujący",
            "battle.insertVD": "Wstaw jednostki z wioski - broniący",
            "battle.insertPD": "Wstaw jednostki z szablonu - broniący",
            "battle.faith": "Wiara",
            "battle.morale": "Morale",
            "battle.luck": "Szczęście",
            "battle.wall": "Mury",
            "battle.nightbonus": "Bonus nocny",
            "battle.leader": "Wielki mistrz",
            "battle.medic": "Medyk",
            "battle.doctor": "Doktor",
            "battle.attack-bonus": "Mistrzostwo broni",
            "battle.iron-walls": "Żelazny mur",
            "battle.clinique": "Klinika",
            "battle.hospital": "Szpital",
            "battle.equip": "Przedmioty rycerza",
            "battle.halberd": "Halabarda Guan Yu",
            "battle.longsword": "Długi miecz Paracelsusa",
            "battle.battleaxe": "Bojowy topór Thorgarda",
            "battle.longbow": "Łuk Nimroda",
            "battle.lance": "Lanca Mieszka",
            "battle.compositebow": "Kompozytowy łuk Nimroda",
            "battle.banner": "Chorągiew Baptystów",
            "battle.star": "Gwiazda poranna Karola",
            "battle.bonfire": "Pochodnia Alethei",
            "battle.scepter": "Berło Vasca",
            "battle.target": "Cel katapult",
            "battle.target-level": "Poziom budynku",
            "bunker": "Bunkier",
            "bunker.header": "Kalkulator optymalnego offa na bunkier",
            "troops": "Koszt jednostek",
            "troops.header": "Kalkulator kosztów produkcji jednostek",
            "troops.th": "Koszty produkcji",
            "troops.units": "Jednostki",
            "troops.building": "Budynki",
            "troops.barracks": "Koszary",
            "troops.preceptory": "Komturia",
            "troops.effects": "Efekty",
            "troops.domination": "Dominacja",
            "troops.training": "Intensywny trening",
            "troops.order": "Zakon",
            "troops.templars": "Zakon Templariuszy",
            "troops.teutonic": "Zakon Krzyżacki",
            "troops.none": "Brak",
            "bashpoints": "Punkty Bojowe",
            "bashpoints.header": "Kalkulator punktów bojowych",
            "bashpoints.th": "Punkty bojowe",
            "bashpoints.attacker": "Jako atakujący",
            "bashpoints.defender": "Jako obrońca",
            "bashpoints.killed": "Zniszczone jednostki",
            "headquarter": "Ratusz",
            "barracks": "Koszary",
            "tavern": "Tawerna",
            "hospital": "Szpital",
            "preceptory": "Komturia",
            "chapel": "Kaplica",
            "church": "Kościół",
            "academy": "Akademia",
            "rally_point": "Plac",
            "statue": "Piedestał",
            "market": "Rynek",
            "timber_camp": "Tartak",
            "clay_pit": "Kopalnia gliny",
            "iron_mine": "Huta żelaza",
            "farm": "Farma",
            "warehouse": "Magazyn",
            "wall": "Mur",
            "none": "Brak",
            "without": "Brak",
            "level_1": "1",
            "level_2": "2",
            "level_3": "3",
            "level_4": "4",
            "level_5": "5",
            "level_6": "6",
            "level_7": "7",
            "level_8": "8",
            "level_9": "9",
            "level_10": "10",
            "level_11": "11",
            "level_12": "12",
            "level_13": "13",
            "level_14": "14",
            "level_15": "15",
            "level_16": "16",
            "level_17": "17",
            "level_18": "18",
            "level_19": "19",
            "level_20": "20"
        },
        "builder_queue": {
            "title": "Budowniczy",
            "started": "Budowniczy Uruchomiony",
            "stopped": "Budowniczy Zatrzymany",
            "settings": "Ustawienia",
            "settings_village_groups": "Buduj w wioskach z grupy",
            "settings_building_sequence": "Szablon kolejki budowy",
            "settings_building_sequence_final": "Finalne poziomy budynków",
            "settings_priorize_farm": "Priorytet farmy, jeżeli brakuje prowiantu",
            "settings_saved": "Ustawienia zapisane!",
            "logs_no_builds": "Nie rozpoczęto żadnej rozbudowy",
            "logs_clear": "Wyczyść logi",
            "sequences": "Szablony",
            "sequences_move_up": "Przesuń w górę",
            "sequences_move_down": "Przesuń w dół",
            "sequences_add_building": "Dodaj budynek",
            "sequences_select_edit": "Wybierz szablon do edytowania",
            "sequences_edit_sequence": "Edytuj szablon",
            "select_group": "Wybierz grupę",
            "add_building_success": "%d dodany na pozycji %d",
            "add_building_limit_exceeded": "%d osiągnął/eła maksymalny poziom (%d)",
            "position": "Pozycja",
            "remove_building": "Usuń budynek z listy",
            "clone": "Klonuj",
            "remove_sequence": "Usuń szablon",
            "name_sequence_min_lenght": "Minimalna długość nazwy szablonu",
            "sequence_created": "Nowy szablon %d utworzony.",
            "sequence_updated": "Szablon %d zaktualizowany.",
            "sequence_removed": "Szablon %d usunięty.",
            "error_sequence_exists": "Ten szablon już istnieje.",
            "error_sequence_no_exists": "Ta sekwencja nie istnieje.",
            "error_sequence_invalid": "Niektóre z wartości szablonu są niepoprawne.",
            "logs_cleared": "Logi wyczyszczone.",
            "create_sequence": "Utwórz szablon",
            "settings_preserve_resources": "Zarezerwowane surowce wioski",
            "settings_preserve_wood": "Zabezpiecz drewno",
            "settings_preserve_clay": "Zabezpiecz glinę",
            "settings_preserve_iron": "Zabezpiecz żelazo",
            "discard_changes_title": "Odrzuć zmianę tytułu",
            "discard_changes_text": "Odrzuć zmianę tekstu",
            "clone_warn_changed_sequence_title": "",
            "clone_warn_changed_sequence_text": "",
            "clone_sequence": "Klonuj szablon",
            "amount": "Ilość",
            "empty_sequence": "Pusty szablon",
            "duration": "Czas",
            "info.header": "Tytuł",
            "info.content": "Zawartość"
        },
        "builder_queue_add_building_modal": {
            "title": "Dodaj nowy budynek"
        },
        "builder_queue_name_sequence_modal": {
            "title": "Nazwa szablonu"
        },
        "builder_queue_remove_sequence_modal": {
            "title": "Usuń szablon",
            "text": "Jesteś pewny, że chcesz usunąć ten szablon? Jeśli ten szablon jest teraz aktywny, inny szablon zostanie wybrany i Budowniczy zatrzyma się."
        },
        "command_queue": {
            "title": "Generał",
            "attack": "Atak",
            "support": "Wsparcie",
            "relocate": "Przeniesienie",
            "sent": "wysłany/e",
            "activated": "włączony",
            "deactivated": "wyłączony",
            "expired": "przedawniony/e",
            "removed": "usunięty/e",
            "added": "dodany/e",
            "general_clear": "Wyczyść logi",
            "general_next_command": "Następny rozkaz",
            "add_basics": "Podstawowe informacje",
            "add_origin": "Źródło",
            "add_selected": "Aktywna wioska",
            "add_target": "Cel",
            "add_map_selected": "Wybrana wioska na mapie",
            "date_type_arrive": "Czas dotarcia na cel",
            "date_type_out": "Czas wyjścia z  twojej wioski",
            "add_current_date": "Obecny czas",
            "add_current_date_plus": "Zwiększ czas o 100 milisekund.",
            "add_current_date_minus": "Zmniejsz czas o 100 milisekund.",
            "add_travel_times": "Czas podróży jednostek",
            "add_date": "Czas/Data",
            "add_no_village": "Wybierz wioskę...",
            "add_village_search": "Znajdź wioskę...",
            "add_clear": "Wyczyść pola",
            "add_insert_preset": "Wybierz szablon",
            "queue_waiting": "Rozkazy",
            "queue_none_added": "Brak dodanych rozkazów.",
            "queue_sent": "Rozkazy wysłane",
            "queue_none_sent": "Brak wysłanych rozkazów.",
            "queue_expired": "Przedawnione rozkazy",
            "queue_none_expired": "Brak przedawnionych rozkazów.",
            "queue_remove": "Usuń rozkaz z listy",
            "queue_filters": "Filtruj rozkazy",
            "filters_selected_village": "Pokaż tylko rozkazy z aktywnej wioski",
            "filters_barbarian_target": "Pokaż tylko rozkazy na wioski barbarzyńskie",
            "filters_attack": "Pokaż ataki",
            "filters_support": "Pokaż wsparcia",
            "filters_relocate": "Pokaż przeniesienia",
            "filters_text_match": "Filtruj za pomocą tekstu...",
            "command_out": "Czas wyjścia",
            "command_time_left": "Pozostały czas",
            "command_arrive": "Czas dotarcia",
            "error_no_units_enough": "Brak wystarczającej liczby jednostek do wysłania rozkazu!",
            "error_not_own_village": "Wioska źródłowa nie należy do ciebie!",
            "error_origin": "Nieprawidłowa wioska źródłowa!",
            "error_target": "Nieprawidłowa wioska cel!",
            "error_no_units": "Nie wybrano jednostek!",
            "error_invalid_date": "Nieprawidłowy Czas",
            "error_already_sent_attack": "Atak %{type} powinien zostać wysłany %{date}",
            "error_already_sent_support": "Wsparcie %{type} powinno zostać wysłane %{date}",
            "error_already_sent_relocate": "Przeniesienie %{type} powinno zostać wysłane %{date}",
            "error_relocate_disabled": "Przeniesienie wojsk wyłączone",
            "error_no_map_selected_village": "Nie zaznaczono wioski na mapie.",
            "error_remove_error": "Błąd usuwania rozkazu.",
            "tab_add": "Dodaj rozkaz",
            "tab_waiting": "Oczekujące",
            "tab_logs": "Logi"
        },
        "faith_checker": {
            "title": "Kapelan",
            "description": "Automatycznie sprawdza kościół/kaplice w prowincjach.",
            "resources": "W wiosce brak surowców do rozpoczęcia budowy",
            "full": "W wiosce znajdują się wierni",
            "chapel": "W wiosce zostanie zbudowana kaplica",
            "church": "W wiosce zostanie zbudowany kościół",
            "activated": "Kapelan aktywowany",
            "deactivated": "Kapelan skończył działanie"
        },
        "fake_sender": {
            "title": "Watażka",
            "fake": "Fejki",
            "logs": "Logi",
            "send_villages": "Fejki na wskazane cele(maks 10)",
            "send_player": "Fejki na wszystkie wioski gracza",
            "send_groups": "Fejki na wioski z danej grupy",
            "send_tribe": "Fejki na losowe wioski plemienia",
            "add_no_village": "Nie wybrano wioski",
            "add_no_player": "Nie wybrano gracza",
            "add_no_tribe": "Nie wybrano plemienia",
            "add_village": "Wybierz wioskę...",
            "add_player": "Wybierz gracza...",
            "add_tribe": "Wybierz plemię...",
            "add_map_selected": "Wybrana wioska z mapy",
            "add_date": "  Czas/Data",
            "add_current_date_minus": "Zmniejsz czas o 100 milisekund",
            "add_current_date": "Obecny czas",
            "add_current_date_plus": "Zwiększ czas o 100 milisekund",
            "attack_interval": "Przerwa między atakami(sek)",
            "group": "Grupa/y wiosek własnych",
            "target_group": "Grupa/y wiosek celi",
            "unit": "Jednostka/i",
            "type": "Rodzaj fejków",
            "own_limit": "Limit fajków z własnej wioski",
            "target_limit": "Maks liczba fejków na cel",
            "clear": "Wyczyść",
            "send": "Wyślij",
            "logs.origin": "Wioska źródłowa",
            "logs.target": "Wioska cel",
            "logs.unit": "Jednostka",
            "logs.type": "Rodzaj",
            "logs.date": "Czas wysłania",
            "logs.noFakes": "Brak wykonanych działań",
            "logs.clear": "Wyczyść logi",
            "general.started": "Watażka uruchomiony",
            "general.stopped": "Watażka zatrzymany",
            "general.saved": "Watażka zatrzymany",
            "attack": "atak",
            "support": "wsparcie",
            "four": "kareta",
            "full": "all-in-one",
            "spear": "Pikinier",
            "sword": "Miecznik",
            "axe": "Topornik",
            "archer": "Łucznik",
            "light_cavalry": "Lekki kawalerzysta",
            "mounted_archer": "Łucznik konny",
            "heavy_cavalry": "Ciężki kawalerzysta",
            "ram": "Taran",
            "catapult": "Katapulta",
            "doppelsoldner": "Berserker",
            "trebuchet": "Trebusz",
            "snob": "Szlachcic",
            "knight": "Rycerz"
        },
        "farm_overflow": {
            "title": "Farmer",
            "open_report": "Otwórz raport",
            "no_report": "Nie ma raportu",
            "reports": "Raporty",
            "date": "Data",
            "status_time_limit": "Cel jest zbyt daleko",
            "status_command_limit": "Limit poleceń",
            "status_full_storage": "Magazyn jest pełny",
            "status_no_units": "Brak dostępnych jednostek",
            "status_abandoned_conquered": "Porzucone podbicie",
            "status_protected_village": "Cel jest chroniony",
            "status_busy_target": "Cel jest atakowany",
            "status_no_targets": "Brak dostępnych celów",
            "status_target_cycle_end": "Cykl wysyłania zakończony",
            "status_not_allowed_points": "Punkty celu niedozwolone",
            "status_unknown": "Nieznany status",
            "status_attacking": "Atakuje",
            "status_waiting_cycle": "Oczekuje",
            "status_user_stop": "",
            "status_expired_step": "",
            "not_loaded": "Nie załadowany.",
            "ignored_targets": "Ignorowane cele",
            "no_ignored_targets": "Brak ignorowanych",
            "included_targets": "Dodatkowe cele",
            "no_included_targets": "Brak dodatkowych",
            "farmer_villages": "Wioski farmiące",
            "no_farmer_villages": "Brak wiosek farm",
            "last_status": "Status",
            "attacking": "Atakuje.",
            "paused": "Zatrzymany.",
            "command_limit": "Limit 50 ataków osiągnięty, oczekiwanie na powrót wojsk.",
            "last_attack": "Ostatni atak",
            "village_switch": "Przejście do wioski %{village}",
            "no_preset": "Brak dostępnych szablonów.",
            "no_selected_village": "Brak dostępnych wiosek.",
            "no_units": "Brak dostępnych jednostek w wiosce, oczekiwanie na powrót wojsk.",
            "no_units_no_commands": "Brak jednostek w wioskach lub powracających wojsk.",
            "no_villages": "Brak dostępnych wiosek, oczekiwanie na powrót wojsk.",
            "preset_first": "Wybierz najpierw szablon!",
            "selected_village": "Wybrana wioska",
            "loading_targets": "Ładowanie celów...",
            "checking_targets": "Sprawdzanie celów...",
            "restarting_commands": "Restartowanie poleceń...",
            "ignored_village": "Cel %{target} dodany do listy pominiętych.(straty)",
            "included_village": "Cel %{target} dodany do listy zawartych",
            "ignored_village_removed": "usunięty z listy ignorowanych",
            "included_village_removed": "usunięty z listy zawartych",
            "priority_target": "dodany do priorytetowych.",
            "analyse_targets": "Analizowanie celów.",
            "step_cycle_restart": "Restartowanie cyklu poleceń...",
            "step_cycle_end": "Lista wiosek zakończona, oczekiwanie na następny cykl.",
            "step_cycle_end_no_villages": "Brak wiosek do rozpoczęcia cyklu.",
            "step_cycle_next": "Lista wiosek się skończyła, następny cykl: %d.",
            "step_cycle_next_no_villages": "Brak wioski do rozpoczęcia cyklu, następny cykl: %d.",
            "full_storage": "Magazyn w wiosce jest pełny",
            "farm_stopped": "Farmer zatrzymany.",
            "farm_started": "Farmer uruchomiony",
            "groups_presets": "Grupy i szablony",
            "presets": "Szablony",
            "group_ignored": "Pomijaj wioski z grupy",
            "group_include": "Dodaj wioski z grupy",
            "group_only": "Atakuj tylko wioski z grup",
            "attack_interval": "Przerwa między atakami (sekundy)",
            "preserve_command_slots": "Rezerwuj sloty poleceń",
            "target_single_attack": "Zezwól celom na jeden atak per wioska",
            "target_multiple_farmers": "Zezwól celom otrzymywać ataki z kilku wiosek",
            "farmer_cycle_interval": "Przerwa pomiędzy cyklami farmienia (minut)",
            "ignore_on_loss": "Pomijaj cele jeśli straty",
            "ignore_full_storage": "Pomijaj wioski jeśli magazyn pełny",
            "step_cycle_header": "Cykl Farmienia",
            "step_cycle": "Włącz Cykl farmienia",
            "step_cycle_notifs": "Powiadomienia",
            "target_filters": "Filtry celów",
            "min_distance": "Minimalna odległość",
            "max_distance": "Maksymalna odległość",
            "min_points": "Minimalna liczba punktów",
            "max_points": "Maksymalna liczba punktów",
            "max_travel_time": "Maksymalny czas podróży (minuty)",
            "logs_limit": "Maksymalna ilość logów",
            "event_attack": "Logi ataków",
            "event_village_change": "Logi zmiany wiosek",
            "event_priority_add": "Logi celów priorytetowych",
            "event_ignored_village": "Logi pominiętych wiosek",
            "settings_saved": "Ustawienia zapisane!",
            "misc": "Różne",
            "attack": "atakuje",
            "no_logs": "Brak zarejestrowanych logów",
            "clear_logs": "Wyczyść logi",
            "reseted_logs": "Zarejestrowane logi zostały wyczyszczone.",
            "date_added": "Data dodania",
            "multiple_attacks_interval": "Przerwa między atakami (sekundy)",
            "next_cycle_in": "Następny cykl za",
            "target_limit_per_village": "Limit celów na wioskę",
            "settings.hotkeySwitch": "Skrót Start/Pauza",
            "settings.hotkeyWindow": "Skrót okna Farmera",
            "settings.remote": "Sterowanie Zdalne za pomocą wiadomości PW",
            "settingError.minDistance": "Odległość celu musi być większa niż %{min}.",
            "settingError.maxDistance": "Odległość celu nie może przekraczać %{max}.",
            "settingError.maxTravelTime": "Maksymalny czas podróży hh:mm:ss.",
            "settingError.randomBase": "Domyślny odstęp musi być pomiędzy %{min} and %{max}.",
            "settingError.minPoints": "Minimalna liczba punktów celu to %{min}.",
            "settingError.maxPoints": "Maksymalna liczba punktów celu to %{max}.",
            "settingError.eventsLimit": "Liczba zdarzeń musi być wartością między %{min} i %{max}.",
            "langName": "Polski",
            "events.nothingYet": "Odpoczywam...",
            "events.sendCommand": "%{origin} atakuje %{target}",
            "events.priorityTargetAdded": "%{target} dodany do priorytetowych.",
            "general.disabled": "— Wyłączony —",
            "settings.docs": "Miłego farmienia!",
            "settings.settings": "Ustawienia",
            "settings.priorityTargets": "Priorytyzuj cele"
        },
        "minimap": {
            "title": "Minimapa",
            "minimap": "Kartograf",
            "highlights": "Podświetlenie",
            "add": "Dodaj podświetlenie",
            "remove": "Usuń podświetlenie",
            "very_small": "Bardzo mała",
            "small": "Mała",
            "big": "Duża",
            "very_big": "Bardzo duża",
            "placeholder_search": "Szukaj gracz/plemię",
            "highlight_add_success": "Podświetlenie dodane",
            "highlight_add_error": "Najpierw sprecyzuj podświetlenie",
            "highlight_update_success": "Podświetlenie zaktualizowane",
            "highlight_remove_success": "Podświetlenie usunięte",
            "highlight_villages": "Wioski",
            "highlight_players": "Gracze",
            "highlight_tribes": "Plemiona",
            "highlight_add_error_exists": "Podświetlenie już istnieje!",
            "highlight_add_error_no_entry": "Najpierw wybierz gracza/plemię!",
            "highlight_add_error_invalid_color": "Nieprawidłowy kolor!",
            "village": "Wioska",
            "player": "Gracz",
            "tribe": "Plemię",
            "color": "Kolor (Hex)",
            "tooltip_pick_color": "Wybierz kolor",
            "misc": "Pozostałe ustawienia",
            "colors_misc": "Różne kolory",
            "colors_diplomacy": "Dyplomacja - kolory",
            "settings_saved": "Ustawienia zapisane!",
            "settings_map_size": "Rozmiar mapy",
            "settings_right_click_action": "PPM aby wykonać działanie na wiosce",
            "highlight_village": "Podświetl wioskę",
            "highlight_player": "Podświetl gracza",
            "highlight_tribe": "Podświetl plemie",
            "settings_show_floating_minimap": "Pokaż ruchomą mapę",
            "settings_show_view_reference": "Pokaż wskaźnik obecnej pozycji",
            "settings_show_continent_demarcations": "Pokaż granice królestw",
            "settings_show_province_demarcations": "Pokaż granice prowincji",
            "settings_show_barbarians": "Pokaż wioski barbarzyńskie",
            "settings_show_ghost_villages": "Pokaż niezaładowane wioski",
            "settings_show_only_custom_highlights": "Pokaż tylko własne podświetlenia",
            "settings_highlight_own": "Podświetl własne wioski",
            "settings_highlight_selected": "Podświetl wybraną wioskę",
            "settings_highlight_diplomacy": "Automatycznie podświetl plemienną dyplomację",
            "settings_colors_background": "Tło minimapy",
            "settings_colors_province": "Granica prowincji",
            "settings_colors_continent": "Granica królestwa",
            "settings_colors_quick_highlight": "Szybkie podświetlenie",
            "settings_colors_tribe": "Własne plemie",
            "settings_colors_player": "Własne wioski",
            "settings_colors_selected": "Wybrana wioska",
            "settings_colors_ghost": "Niezaładowana wioska",
            "settings_colors_ally": "Sojusznik",
            "settings_colors_pna": "PON",
            "settings_colors_enemy": "Wróg",
            "settings_colors_other": "Pozostałe wioski graczy",
            "settings_colors_barbarian": "Wioski barbarzyńskie",
            "settings_colors_view_reference": "Wskaźnik obecnej pozycji",
            "settings_reset": "Ustawienia zresetowane",
            "tooltip_village": "Wioska",
            "tooltip_village_points": "Punkty wioski",
            "tooltip_player": "Nazwa gracza",
            "tooltip_player_points": "Punkty gracza",
            "tooltip_tribe": "Plemię",
            "tooltip_tribe_points": "Punkty plemienia",
            "tooltip_province": "Prowincja",
            "no_highlights": "Brak utworzonych podświetleń",
            "reset_confirm_title": "Resetuj ustawienia",
            "reset_confirm_text": "Wszystkie ustawienia zostaną przywrócone do domyślnych.",
            "reset_confirm_highlights_text": "Jak również wszystkie podświetlenia zostaną usunięte.",
            "default_village_colors_info": "Informacje o domyślnych kolorach wiosek",
            "entry/id": "Wioska/gracz/plemie",
            "tooltip.village-id": "Id wioski",
            "tooltip.player-id": "Id gracza",
            "tooltip.tribe-id": "Id plemienia"
        },
        "mint_helper": {
            "title": "Mincerz",
            "description": "Automatycznie wybija monety gdy włączony.",
            "activated": "Mincerz aktywowany",
            "deactivated": "Mincerz deaktywowany"
        },
        "preset_creator": {
            "title": "Kwatermistrz",
            "description": "Automatycznie tworzy szablony do rekrutacji, fejków i farmy.",
            "activated": "Kwatermistrz aktywowany",
            "done": "Kwatermistrz utworzył szablony",
            "deactivated": "Kwatermistrz skończył działanie"
        },
        "recruit_queue": {
            "title": "Kapitan",
            "clearL": "Wyczyść logi",
            "start": "Rekrutuj",
            "logs.noRecruits": "Nie rozpoczęto żadnych rekrutacji",
            "amount": "Ilość",
            "unit": "Jednostka",
            "recruit.own": "Rekrutacja wg własnych ustawień",
            "recruit.presets": "Rekrutacja z szablonów",
            "presets": "Szablonowa",
            "own": "Własne ustawienia",
            "logs": "Logi",
            "group": "Grupa wiosek",
            "preset": "Szablon cząstkowy",
            "presetfinal": "Szablon docelowy",
            "spear": "Pikinier",
            "sword": "Miecznik",
            "axe": "Topornik",
            "archer": "Łucznik",
            "light_cavalry": "Lekki kawalerzysta",
            "mounted_archer": "Łucznik konny",
            "heavy_cavalry": "Ciężki kawalerzysta",
            "ram": "Taran",
            "catapult": "Katapulta",
            "doppelsoldner": "Berserker",
            "trebuchet": "Trebusz",
            "snob": "Szlachcic",
            "knight": "Rycerz",
            "general.started": "Kapitan Uruchomiony!",
            "general.stopped": "Kapitan Zatrzymany!",
            "clear": "Wyczyść"
        },
        "report_sender": {
            "title": "Goniec",
            "description": "Automatycznie wysyła raporty z misji szpiegowskich, ataków oraz wsparć tworząc odpowiednie wiadomości.",
            "activated": "Goniec aktywowany",
            "deactivated": "Goniec skończył działanie"
        },
        "spy_master": {
            "title": "Zwiadowca",
            "spy": "Akcje Szpiegowskie",
            "recruit": "Auto-Rekrutacja",
            "countermeasures": "Kontrwywiad",
            "torpedo": "Cel misji szpiegowskich",
            "spyU": "Szpieguj jednostki",
            "spyB": "Szpieguj budynki",
            "spyA": "Efektywne szpiegowanie",
            "spyP": "Szpieguj całego gracza",
            "sabotage": "Sabotuj wioskę",
            "spyU.text": "Wysyła 7 szpiegów z twoich wiosek na wioskę wskazaną aby zdobyć informacje tylko p jednostkach.",
            "spyB.text": "Wysyła 7 szpiegów z twoich wiosek na wioskę wskazaną aby zdobyć informacje tylko o budynkach.",
            "sabotage.text": "Wysyła po 3 szpiegów z twoich wiosek na wioskę wskazaną aby dokonać sabotażu na budynkach.",
            "spyA.text": "Wysyła 8-10 szpiegów z twoich wiosek na wioskę wskazaną aby zdobyć informacje o budynkach oraz jednostkach(pierwsi szpiedzy na budynki ostatni na jednostki).",
            "spyP.text": "Wysyła szpiegów z twoich wiosek na wioski gracza aby zdobyć informacje o budynkach oraz jednostkach(pierwsi szpiedzy na budynki ostatni na jednostki).",
            "send": "Wyślij",
            "sabote": "Sabotuj",
            "sendingU": "Wszyscy na jednostki",
            "sendingB": "Wszyscy na budynki",
            "sendingS": "3 do sabotowania budynków na wrogiej wiosce",
            "sendingA": "Pierwsi na budynki kolejni na jednsotki - największa efektwnosc.",
            "sendingP": "Pierwsi na budynki kolejni na jednsotki - największa efektwnosc.",
            "entry/id": "Gracz",
            "entry/vid": "Wioska",
            "entry/building": "Wpisz budynek",
            "entry/level": "Wpisz poziom",
            "entry/unit": "Jednostka",
            "entry/replacement": "Zamiennik",
            "recruiting": "Rekrutacja",
            "recruit.text": "Rekrutuje wszystkich szpiegów na wszystkich wioskach.",
            "recruit.tip": "xxx",
            "recruit.btn": "Rekrutuj",
            "camouflage": "Kamuflaż",
            "camouflage.text": "Wybierz budynek oraz poziom jaki ma być widoczny dla wrogiego szpiega.",
            "camouflage.tip": "Zmienia widoczność poziomu wybranego budynku na wszystkich wioskach gdzie jest dostępna opcja kamuflażu",
            "camouflage.btn": "Kamufluj",
            "camouflage.set": "Kamuflaż ustawiony.",
            "switch": "Zamiana broni",
            "switch.text": "Wybierz typy jednostek które zamienią się bronią by oszukać wrogiego szpiega.",
            "switch.tip": "Zamienia broń między dwoma typami jednostek na wszystkich wioskach, na których jest to możliwe.",
            "switch.btn": "Zamień",
            "switch.set": "Zamiana broni ustawiona.",
            "dummies": "Atrapy",
            "dummies.text": "Wybierz jednostkę, która ma posłużyć jako atrapa widoczna dla wrogiego szpiega.",
            "dummies.tip": "Aktywuje Atrapy, uzupełnia wolny prowiant o wybrane jednotski na wszystkich wioskach gdzie są one dostępne.",
            "dummies.btn": "Postaw",
            "dummies.set": "Atrapy postawione.",
            "exchange": "Wymiana",
            "exchange.text": "Dzięki tej opcji wrogi szpieg pozostawi raport na temat swojej własnej wioski.",
            "exchange.tip": "Aktywuje Wymianę na wszystkich wioskach gdzie jest ona dostępna.",
            "exchange.btn": "Aktywuj",
            "exchange.set": "Wymiana ustawiona.",
            "general.stopped": "Zwiadowca zatrzymany",
            "general.started": "Zwiadowca uruchomiony",
            "origin": "Wioska źródłowa",
            "target": "Wioska cel",
            "type": "Typ",
            "amount": "Ilość",
            "date": "Czas wysłania",
            "clear": "Wyczyść",
            "logs": "Logi",
            "logs.clear": "Wyczyść logi",
            "logs.noMissions": "Brak wysłanych szpiegów.",
            "headquarter": "Ratusz",
            "barracks": "Koszary",
            "tavern": "Tawerna",
            "hospital": "Szpital",
            "preceptory": "Komturia",
            "chapel": "Kaplica",
            "church": "Kościół",
            "academy": "Akademia",
            "rally_point": "Plac",
            "statue": "Piedestał",
            "market": "Rynek",
            "timber_camp": "Tartak",
            "clay_pit": "Kopalnia gliny",
            "iron_mine": "Huta żelaza",
            "farm": "Farma",
            "warehouse": "Magazyn",
            "wall": "Mur",
            "spear": "Pikinier",
            "sword": "Miecznik",
            "axe": "Topornik",
            "archer": "Łucznik",
            "light_cavalry": "Lekki kawalerzysta",
            "mounted_archer": "Łucznik konny",
            "heavy_cavalry": "Ciężki kawalerzysta",
            "ram": "Taran",
            "catapult": "Katapulta",
            "doppelsoldner": "Berserker",
            "trebuchet": "Trebusz",
            "snob": "Szlachcic",
            "knight": "Rycerz",
            "none": "-- Wyłączona --"
        },
        "spy_recruiter": {
            "title": "Szpieg",
            "description": "Automatycznie rekrutuje szpiegów jesli brak na wioskach.",
            "activated": "Szpieg aktywowany",
            "deactivated": "Szpieg skończył działanie",
            "revived": "Szpiedzy dodani do kolejki rekrutacji"
        },
        "common": {
            "start": "Start",
            "started": "Uruchomiony",
            "pause": "Pauza",
            "paused": "Wstrzymany",
            "stop": "Zatrzymany",
            "stopped": "Zatrzymany",
            "status": "Status",
            "none": "Żaden",
            "info": "Informacje",
            "settings": "Ustawienia",
            "others": "Inne",
            "village": "Wioska",
            "villages": "Wioski",
            "building": "Budynek",
            "buildings": "Budynki",
            "level": "Poziom",
            "registers": "Rejestry",
            "filters": "Filtry",
            "add": "Dodaj",
            "waiting": "Oczekujące",
            "attack": "Atak",
            "support": "Wsparcie",
            "relocate": "Przeniesienie",
            "activate": "Aktywuj",
            "deactivate": "Wyłącz",
            "units": "Jednostki",
            "officers": "Oficerowie",
            "origin": "Źródło",
            "target": [
                "Cel",
                "Cele"
            ],
            "save": "Zapisz",
            "logs": "Logi",
            "no-results": "Brak wyników...",
            "selected": "Wybrana",
            "now": "Teraz",
            "costs": "Koszty",
            "duration": "Czas",
            "points": "Punkty",
            "player": "Gracz",
            "players": "Gracze",
            "next_features": "Następne funkcje",
            "misc": "Różne",
            "colors": "Kolory",
            "reset": "Resetuj",
            "here": "tutaj",
            "disabled": "— Wyłączony —",
            "cancel": "Anuluj",
            "actions": "Akcje",
            "remove": "Usuń",
            "started_at": "Uruchomiony",
            "arrive": "Dotarcie",
            "settings_saved": "Ustawienia zapisane",
            "discard": "Odrzuć",
            "new_version": "Nowa wersja",
            "check_changes": "Sprawdź zmiany",
            "headquarter": "Ratusz",
            "barracks": "Koszary",
            "tavern": "Tawerna",
            "hospital": "Szpital",
            "preceptory": "Komturia",
            "chapel": "Kaplica",
            "church": "Kościół",
            "academy": "Akademia",
            "rally_point": "Plac",
            "statue": "Piedestał",
            "market": "Rynek",
            "timber_camp": "Tartak",
            "clay_pit": "Kopalnia gliny",
            "iron_mine": "Huta żelaza",
            "farm": "Farma",
            "warehouse": "Magazyn",
            "wall": "Mur",
            "spear": "Pikinier",
            "sword": "Miecznik",
            "axe": "Topornik",
            "archer": "Łucznik",
            "light_cavalry": "Lekki kawalerzysta",
            "mounted_archer": "Łucznik konny",
            "heavy_cavalry": "Ciężki kawalerzysta",
            "ram": "Taran",
            "catapult": "Katapulta",
            "doppelsoldner": "Berserker",
            "trebuchet": "Trebusz",
            "snob": "Szlachcic",
            "knight": "Rycerz",
            "firefox_shill": ""
        }
    },
    "pl_pl": {
        "about": {
            "contact": "Kontakt",
            "email": "Email",
            "links": "Linki projektów",
            "source_code": "Kod źródłowy",
            "issues_suggestions": "Błędy/sugestie",
            "translations": "Tłumaczenia"
        },
        "alert_sender": {
            "title": "Wartownik",
            "description": "Automatycznie wysyła informacje o nadchodzacych atakach do pw z 'Attacks' w nazwie.",
            "activated": "Wartownik aktywowany",
            "deactivated": "Wartownik skończył działanie"
        },
        "army_helper": {
            "title": "Administrator",
            "presets": "Szablony",
            "army": "Wojsko",
            "balancer": "Balanser",
            "none": "-- Wyłączona --",
            "presets-all": "Wszystkie szablony",
            "presets.all": "Przypisz wszystkie szablony do wszystkich wiosek.",
            "asigningAll": "Przypisuje wszystkie szablony",
            "presets-name": "Szablony z nazwą",
            "entry/name": "Wpisz frazę",
            "presets.name": "Przypisz szablony zawierające wskazaną frazę do wszystkich wiosek.",
            "asigningName": "Przypisuje określone szablony",
            "presets-group": "Szablony do grupy",
            "entry/group": "Wpisz nazwę grupy",
            "presets.group": "Przypisz wszystkie szablony do wybranej grupy wiosek.",
            "asigningGroup": "Przypisuje szablony do wybranej grupy",
            "presets-ng": "Szablony - zaawansowane przypisywanie",
            "presets.ng": "Przypisz szablony zawierające wskazaną fraze do wybranej grupy wiosek.",
            "asigningNG": "Przypisuje określone szablony do wybranej grupy wiosek",
            "asign": "Przypisz",
            "check": "Sprawdź ilość jednostek w wioskach",
            "check.tip": "Zlicza jednostki w wioskach",
            "check.btn": "Zlicz",
            "army.amounts": "Wojsko",
            "unit": "Jednostka",
            "available": "Dostępne",
            "own": "Posiadane",
            "in-town": "W wioskach",
            "support": "Wsparcie",
            "recruiting": "Rekrutacja",
            "total": "Wszystko",
            "calculated": "Wojsko zliczone!",
            "assigned": "Szablony przypisane!",
            "assignedN": "Szablony przypisane wg nazwy!",
            "assignedG": "Szablony przypisane do grupy wiosek!",
            "assignedNG": "Szablony przypisane wg nazwy do grupy wiosek!",
            "deffensive-troops": "Defensywne jednostki",
            "offensive-troops": "Ofensywne jednostki",
            "balance-all": "Wszystkie typy wojsk",
            "balance.all": "Zbalansuj po równo całe swoje wojsko.",
            "balancingAll": "Balansuje wojsko",
            "balance-unit": "Jednostka",
            "balance.unit": "Zbalansuj po równo wojska danego typu.",
            "balancingUnit": "Balansuje wojsko - jednostka",
            "balance-group": "Grupa",
            "balance.group": "Zbalansuj po równo wojska w danej grupie wiosek.",
            "balancingGroup": "Balansuje wojsko - grupa",
            "balance-ug": "Grupa/Jednostka",
            "balance.ug": "Zbalansuj po równo wojska w danej grupie wiosek dany typ jednostki.(np miecznik w grupie Deff)",
            "balancingUG": "Balansuje wojsko - grupa+jednostka",
            "balance": "Balansuj",
            "balanced": "Wojska zbalansowane!",
            "balancedN": "Wojska zbalansowane wg wskazanego typu!",
            "balancedG": "Wojska zbalansowane wg wskazanej grupy!",
            "balancedNG": "Wojska zbalansowane wg typu i w danej grupie!",
            "spear": "Pikinier",
            "sword": "Miecznik",
            "axe": "Topornik",
            "archer": "Łucznik",
            "light_cavalry": "Lekki kawalerzysta",
            "mounted_archer": "Łucznik konny",
            "heavy_cavalry": "Ciężki kawalerzysta",
            "ram": "Taran",
            "catapult": "Katapulta",
            "doppelsoldner": "Berserker",
            "trebuchet": "Trebusz",
            "snob": "Szlachcic",
            "knight": "Rycerz",
            "special-troops": "Specjalne jednostki"
        },
        "attack_view": {
            "title": "Strażnik",
            "filter_types": "Rodzaj",
            "filter_show_attacks_tooltip": "Pokaż ataki",
            "filter_show_supports_tooltip": "Pokaż wsparcia",
            "filter_show_relocations_tooltip": "Pokaż przeniesienia",
            "filter_incoming_units": "Nadchodzące jednostki",
            "commands_copy_arrival_tooltip": "Kopiuj czas dotarcia.",
            "commands_copy_backtime_tooltip": "Kopiuj czas powrotu.",
            "commands_set_remove_tooltip": "Wstaw rozkaz wycofania wojsk przed dotarciem ataku do Kolejki rozkazów.",
            "command_type_tooltip": "Rodzaj",
            "slowest_unit_tooltip": "Najwolniejsza jednostka",
            "command_type": "Rodzaj",
            "slowest_unit": "Co?",
            "actions": "Dostępne akcje",
            "no_incoming": "Brak nadchodzących wojsk.",
            "copy": "Kopiuj",
            "current_only_tooltip": "Tylko aktywna wioska",
            "arrive": "Dotrze",
            "arrivetime": "Czas dotarcia skopiowany!",
            "backtime": "Czas powrotu skopiowany!",
            "spyorigin": "Szpiedzy wysłani do %{name}!",
            "commands.tooltip.kill": "Wstaw rozkaz klinowania do Kolejki rozkazów. MAŁY KLIN.",
            "commands.tooltip.killBig": "Wstaw rozkaz klinowania do Kolejki rozkazów. DUŻY KLIN.",
            "commands.tooltip.bunker": "Zabunkruj wioske z wojsk znajdujących się na najbliższych twoich wioskach które zdążą przed atakiem. Uwaga! robisz to na własną odpowiedzialność.",
            "commands.tooltip.spy": "Szpieguj wioske źródłową.",
            "commands.tooltip.withdraw": "Wycofaj wszystkie wsparcia sekundę przed wejsciem tego ataku."
        },
        "auto_collector": {
            "title": "Kolekcjoner",
            "description": "Automatyczny kolekcjoner depozytu/drugiej wioski.",
            "activated": "Kolekcjoner aktywowany",
            "deactivated": "Kolekcjoner deaktywowany"
        },
        "auto_foundator": {
            "title": "Fundator",
            "description": "Automatycznie wykonuje darowizny na plemie co jedną godzinę 2% z wszystkich wiosek.",
            "activated": "Fundator aktywowany",
            "deactivated": "Fundator skończył działanie"
        },
        "auto_healer": {
            "title": "Medyk",
            "description": "Automatycznie przywraca uzdrowione jednostki ze szpitala.",
            "activated": "Medyk aktywowany",
            "deactivated": "Medyk skończył działanie"
        },
        "battle_calculator": {
            "title": "Kalkulator",
            "check.btn": "Przelicz",
            "simulate.btn": "Symuluj",
            "calculated": "Obliczono wynik bitwy!",
            "inserted": "Obliczono wynik bitwy!",
            "name": "Pełna nazwa szablonu",
            "id": "Wioska",
            "wood": "Drewno",
            "iron": "Żelazo",
            "clay": "Glina",
            "food": "Prowiant",
            "attack": "Siła ataku",
            "load": "Ładowność",
            "buildtime": "Czas rekrutacji",
            "defarc": "Obrona przeciw łucznikom",
            "definf": "obrona przeciw piechocie",
            "defcav": "Obrona przeciw kawaleri",
            "attackarc": "Siła ataku łuczników",
            "attackinf": "Siła ataku piechoty",
            "attackcav": "Siła ataku kawaleri",
            "discipline": "Dyscyplina",
            "speed": "Prędkość",
            "battle": "Bitwa",
            "battle.predamage": "Uszkodzenia wstępne",
            "battle.bonuses": "Modyfikatory bitewne",
            "battle.options": "Szybkie opcje",
            "battle.header": "Kalkulator bitewny",
            "battle.killrateA": "Procent strat",
            "battle.attackBashpoint": "Ofensywne punkty bojowe",
            "battle.strentghAttack": "Siła bojowa off",
            "battle.killrateD": "Procent strat",
            "battle.defenceBashpoint": "Defensywne punkty bojowe",
            "battle.strentghDefend": "Siła bojowa deff",
            "battle.attackModifier": "Modyfikator ataku",
            "battle.defenceModifier": "Modyfikator obrony",
            "battle.provisions": "Całkowity prowiant",
            "battle.killedprovisions": "Prowiant stracony",
            "battle.doublestrength": "Szał berków?",
            "battle.strongesttype": "Najwięcej wojsk typu",
            "battle.beds": "Liczba łóżek - uratowanych jednostek",
            "battle.survivedprovisions": "Prowiant ocalały",
            "battle.attacker": "Atakujący",
            "battle.unit": "Jednostka",
            "battle.amount": "Ilość",
            "battle.loses": "Straty",
            "battle.revived": "Uleczone",
            "battle.survivors": "Ocalałe",
            "battle.survivorsA": "Ocalałe(z uratowanymi)",
            "battle.survivorsD": "Ocalałe(bez uratowanych)",
            "battle.defender": "Obrońca",
            "battle.damage": "Uszkodzenia taranów",
            "battle.damageCatapult": "Uszkodzenia katapult",
            "battle.downgrade": "Mur uszkodzony z poziomu ",
            "battle.downgradeCatapult": " uszkodzony/a z poziomu ",
            "battle.to": " do ",
            "battle.insert": "Wstaw ocalałe jednostki",
            "battle.insertvillage": "Wstaw z wioski",
            "battle.insertpreset": "Wstaw z szablonu",
            "battle.insertV": "Wstaw jednostki z wioski - atakujący",
            "battle.insertP": "Wstaw jednostki z szablonu - atakujący",
            "battle.insertVD": "Wstaw jednostki z wioski - broniący",
            "battle.insertPD": "Wstaw jednostki z szablonu - broniący",
            "battle.faith": "Wiara",
            "battle.morale": "Morale",
            "battle.luck": "Szczęście",
            "battle.wall": "Mury",
            "battle.nightbonus": "Bonus nocny",
            "battle.leader": "Wielki mistrz",
            "battle.medic": "Medyk",
            "battle.doctor": "Doktor",
            "battle.attack-bonus": "Mistrzostwo broni",
            "battle.iron-walls": "Żelazny mur",
            "battle.clinique": "Klinika",
            "battle.hospital": "Szpital",
            "battle.equip": "Przedmioty rycerza",
            "battle.halberd": "Halabarda Guan Yu",
            "battle.longsword": "Długi miecz Paracelsusa",
            "battle.battleaxe": "Bojowy topór Thorgarda",
            "battle.longbow": "Łuk Nimroda",
            "battle.lance": "Lanca Mieszka",
            "battle.compositebow": "Kompozytowy łuk Nimroda",
            "battle.banner": "Chorągiew Baptystów",
            "battle.star": "Gwiazda poranna Karola",
            "battle.bonfire": "Pochodnia Alethei",
            "battle.scepter": "Berło Vasca",
            "battle.target": "Cel katapult",
            "battle.target-level": "Poziom budynku",
            "bunker": "Bunkier",
            "bunker.header": "Kalkulator optymalnego offa na bunkier",
            "troops": "Koszt jednostek",
            "troops.header": "Kalkulator kosztów produkcji jednostek",
            "troops.th": "Koszty produkcji",
            "troops.units": "Jednostki",
            "troops.building": "Budynki",
            "troops.barracks": "Koszary",
            "troops.preceptory": "Komturia",
            "troops.effects": "Efekty",
            "troops.domination": "Dominacja",
            "troops.training": "Intensywny trening",
            "troops.order": "Zakon",
            "troops.templars": "Zakon Templariuszy",
            "troops.teutonic": "Zakon Krzyżacki",
            "troops.none": "Brak",
            "bashpoints": "Punkty Bojowe",
            "bashpoints.header": "Kalkulator punktów bojowych",
            "bashpoints.th": "Punkty bojowe",
            "bashpoints.attacker": "Jako atakujący",
            "bashpoints.defender": "Jako obrońca",
            "bashpoints.killed": "Zniszczone jednostki",
            "headquarter": "Ratusz",
            "barracks": "Koszary",
            "tavern": "Tawerna",
            "hospital": "Szpital",
            "preceptory": "Komturia",
            "chapel": "Kaplica",
            "church": "Kościół",
            "academy": "Akademia",
            "rally_point": "Plac",
            "statue": "Piedestał",
            "market": "Rynek",
            "timber_camp": "Tartak",
            "clay_pit": "Kopalnia gliny",
            "iron_mine": "Huta żelaza",
            "farm": "Farma",
            "warehouse": "Magazyn",
            "wall": "Mur",
            "none": "Brak",
            "without": "Brak",
            "level_1": "1",
            "level_2": "2",
            "level_3": "3",
            "level_4": "4",
            "level_5": "5",
            "level_6": "6",
            "level_7": "7",
            "level_8": "8",
            "level_9": "9",
            "level_10": "10",
            "level_11": "11",
            "level_12": "12",
            "level_13": "13",
            "level_14": "14",
            "level_15": "15",
            "level_16": "16",
            "level_17": "17",
            "level_18": "18",
            "level_19": "19",
            "level_20": "20"
        },
        "builder_queue": {
            "title": "Budowniczy",
            "started": "Budowniczy Uruchomiony",
            "stopped": "Budowniczy Zatrzymany",
            "settings": "Ustawienia",
            "settings_village_groups": "Buduj w wioskach z grupy",
            "settings_building_sequence": "Szablon kolejki budowy",
            "settings_building_sequence_final": "Finalne poziomy budynków",
            "settings_priorize_farm": "Priorytet farmy, jeżeli brakuje prowiantu",
            "settings_saved": "Ustawienia zapisane!",
            "logs_no_builds": "Nie rozpoczęto żadnej rozbudowy",
            "logs_clear": "Wyczyść logi",
            "sequences": "Szablony",
            "sequences_move_up": "Przesuń w górę",
            "sequences_move_down": "Przesuń w dół",
            "sequences_add_building": "Dodaj budynek",
            "sequences_select_edit": "Wybierz szablon do edytowania",
            "sequences_edit_sequence": "Edytuj szablon",
            "select_group": "Wybierz grupę",
            "add_building_success": "%d dodany na pozycji %d",
            "add_building_limit_exceeded": "%d osiągnął/eła maksymalny poziom (%d)",
            "position": "Pozycja",
            "remove_building": "Usuń budynek z listy",
            "clone": "Klonuj",
            "remove_sequence": "Usuń szablon",
            "name_sequence_min_lenght": "Minimalna długość nazwy szablonu",
            "sequence_created": "Nowy szablon %d utworzony.",
            "sequence_updated": "Szablon %d zaktualizowany.",
            "sequence_removed": "Szablon %d usunięty.",
            "error_sequence_exists": "Ten szablon już istnieje.",
            "error_sequence_no_exists": "Ta sekwencja nie istnieje.",
            "error_sequence_invalid": "Niektóre z wartości szablonu są niepoprawne.",
            "logs_cleared": "Logi wyczyszczone.",
            "create_sequence": "Utwórz szablon",
            "settings_preserve_resources": "Zarezerwowane surowce wioski",
            "settings_preserve_wood": "Zabezpiecz drewno",
            "settings_preserve_clay": "Zabezpiecz glinę",
            "settings_preserve_iron": "Zabezpiecz żelazo",
            "discard_changes_title": "Odrzuć zmianę tytułu",
            "discard_changes_text": "Odrzuć zmianę tekstu",
            "clone_warn_changed_sequence_title": "",
            "clone_warn_changed_sequence_text": "",
            "clone_sequence": "Klonuj szablon",
            "amount": "Ilość",
            "empty_sequence": "Pusty szablon",
            "duration": "Czas",
            "info.header": "Tytuł",
            "info.content": "Zawartość"
        },
        "builder_queue_add_building_modal": {
            "title": "Dodaj nowy budynek"
        },
        "builder_queue_name_sequence_modal": {
            "title": "Nazwa szablonu"
        },
        "builder_queue_remove_sequence_modal": {
            "title": "Usuń szablon",
            "text": "Jesteś pewny, że chcesz usunąć ten szablon? Jeśli ten szablon jest teraz aktywny, inny szablon zostanie wybrany i Budowniczy zatrzyma się."
        },
        "command_queue": {
            "title": "Generał",
            "attack": "Atak",
            "support": "Wsparcie",
            "relocate": "Przeniesienie",
            "sent": "wysłany/e",
            "activated": "włączony",
            "deactivated": "wyłączony",
            "expired": "przedawniony/e",
            "removed": "usunięty/e",
            "added": "dodany/e",
            "general_clear": "Wyczyść logi",
            "general_next_command": "Następny rozkaz",
            "add_basics": "Podstawowe informacje",
            "add_origin": "Źródło",
            "add_selected": "Aktywna wioska",
            "add_target": "Cel",
            "add_map_selected": "Wybrana wioska na mapie",
            "date_type_arrive": "Czas dotarcia na cel",
            "date_type_out": "Czas wyjścia z  twojej wioski",
            "add_current_date": "Obecny czas",
            "add_current_date_plus": "Zwiększ czas o 100 milisekund.",
            "add_current_date_minus": "Zmniejsz czas o 100 milisekund.",
            "add_travel_times": "Czas podróży jednostek",
            "add_date": "Czas/Data",
            "add_no_village": "Wybierz wioskę...",
            "add_village_search": "Znajdź wioskę...",
            "add_clear": "Wyczyść pola",
            "add_insert_preset": "Wybierz szablon",
            "queue_waiting": "Rozkazy",
            "queue_none_added": "Brak dodanych rozkazów.",
            "queue_sent": "Rozkazy wysłane",
            "queue_none_sent": "Brak wysłanych rozkazów.",
            "queue_expired": "Przedawnione rozkazy",
            "queue_none_expired": "Brak przedawnionych rozkazów.",
            "queue_remove": "Usuń rozkaz z listy",
            "queue_filters": "Filtruj rozkazy",
            "filters_selected_village": "Pokaż tylko rozkazy z aktywnej wioski",
            "filters_barbarian_target": "Pokaż tylko rozkazy na wioski barbarzyńskie",
            "filters_attack": "Pokaż ataki",
            "filters_support": "Pokaż wsparcia",
            "filters_relocate": "Pokaż przeniesienia",
            "filters_text_match": "Filtruj za pomocą tekstu...",
            "command_out": "Czas wyjścia",
            "command_time_left": "Pozostały czas",
            "command_arrive": "Czas dotarcia",
            "error_no_units_enough": "Brak wystarczającej liczby jednostek do wysłania rozkazu!",
            "error_not_own_village": "Wioska źródłowa nie należy do ciebie!",
            "error_origin": "Nieprawidłowa wioska źródłowa!",
            "error_target": "Nieprawidłowa wioska cel!",
            "error_no_units": "Nie wybrano jednostek!",
            "error_invalid_date": "Nieprawidłowy Czas",
            "error_already_sent_attack": "Atak %{type} powinien zostać wysłany %{date}",
            "error_already_sent_support": "Wsparcie %{type} powinno zostać wysłane %{date}",
            "error_already_sent_relocate": "Przeniesienie %{type} powinno zostać wysłane %{date}",
            "error_relocate_disabled": "Przeniesienie wojsk wyłączone",
            "error_no_map_selected_village": "Nie zaznaczono wioski na mapie.",
            "error_remove_error": "Błąd usuwania rozkazu.",
            "tab_add": "Dodaj rozkaz",
            "tab_waiting": "Oczekujące",
            "tab_logs": "Logi"
        },
        "faith_checker": {
            "title": "Kapelan",
            "description": "Automatycznie sprawdza kościół/kaplice w prowincjach.",
            "resources": "W wiosce brak surowców do rozpoczęcia budowy",
            "full": "W wiosce znajdują się wierni",
            "chapel": "W wiosce zostanie zbudowana kaplica",
            "church": "W wiosce zostanie zbudowany kościół",
            "activated": "Kapelan aktywowany",
            "deactivated": "Kapelan skończył działanie"
        },
        "fake_sender": {
            "title": "Watażka",
            "fake": "Auto fejki",
            "logs": "Logi",
            "send_villages": "Fejki na wskazane cele(maks 10)",
            "send_player": "Fejki na wszystkie wioski gracza",
            "send_groups": "Fejki na wioski z danej grupy",
            "send_tribe": "Fejki na losowe wioski plemienia",
            "add_no_village": "Nie wybrano wioski",
            "add_no_player": "Nie wybrano gracza",
            "add_no_tribe": "Nie wybrano plemienia",
            "add_village": "Wybierz wioskę...",
            "add_player": "Wybierz gracza...",
            "add_tribe": "Wybierz plemię...",
            "add_map_selected": "Wybrana wioska z mapy",
            "add_date": "  Czas/Data",
            "add_current_date_minus": "Zmniejsz czas o 100 milisekund",
            "add_current_date": "Obecny czas",
            "add_current_date_plus": "Zwiększ czas o 100 milisekund",
            "attack_interval": "Przerwa między atakami(sek)",
            "group": "Grupa/y wiosek własnych",
            "target_group": "Grupa/y wiosek celi",
            "unit": "Jednostka/i",
            "type": "Rodzaj fejków",
            "own_limit": "Limit fajków z własnej wioski",
            "target_limit": "Maks liczba fejków na cel",
            "clear": "Wyczyść",
            "send": "Wyślij",
            "logs.origin": "Wioska źródłowa",
            "logs.target": "Wioska cel",
            "logs.unit": "Jednostka",
            "logs.type": "Rodzaj",
            "logs.date": "Czas wysłania",
            "logs.noFakes": "Brak wykonanych działań",
            "logs.clear": "Wyczyść logi",
            "general.started": "Watażka uruchomiony",
            "general.stopped": "Watażka zatrzymany",
            "general.saved": "Watażka zatrzymany",
            "attack": "atak",
            "support": "wsparcie",
            "four": "kareta",
            "full": "all-in-one",
            "spear": "Pikinier",
            "sword": "Miecznik",
            "axe": "Topornik",
            "archer": "Łucznik",
            "light_cavalry": "Lekki kawalerzysta",
            "mounted_archer": "Łucznik konny",
            "heavy_cavalry": "Ciężki kawalerzysta",
            "ram": "Taran",
            "catapult": "Katapulta",
            "doppelsoldner": "Berserker",
            "trebuchet": "Trebusz",
            "snob": "Szlachcic",
            "knight": "Rycerz"
        },
        "farm_overflow": {
            "title": "Farmer",
            "open_report": "Otwórz raport",
            "no_report": "Nie ma raportu",
            "reports": "Raporty",
            "date": "Data",
            "status_time_limit": "Cel jest zbyt daleko",
            "status_command_limit": "Limit poleceń",
            "status_full_storage": "Magazyn jest pełny",
            "status_no_units": "Brak dostępnych jednostek",
            "status_abandoned_conquered": "Porzucone podbicie",
            "status_protected_village": "Cel jest chroniony",
            "status_busy_target": "Cel jest atakowany",
            "status_no_targets": "Brak dostępnych celów",
            "status_target_cycle_end": "Cykl wysyłania zakończony",
            "status_not_allowed_points": "Punkty celu niedozwolone",
            "status_unknown": "Nieznany status",
            "status_attacking": "Atakuje",
            "status_waiting_cycle": "Oczekuje",
            "status_user_stop": "",
            "status_expired_step": "",
            "not_loaded": "Nie załadowany.",
            "ignored_targets": "Ignorowane cele",
            "no_ignored_targets": "Brak ignorowanych",
            "included_targets": "Dodatkowe cele",
            "no_included_targets": "Brak dodatkowych",
            "farmer_villages": "Wioski farmiące",
            "no_farmer_villages": "Brak wiosek farm",
            "last_status": "Status",
            "attacking": "Atakuje.",
            "paused": "Zatrzymany.",
            "command_limit": "Limit 50 ataków osiągnięty, oczekiwanie na powrót wojsk.",
            "last_attack": "Ostatni atak",
            "village_switch": "Przejście do wioski %{village}",
            "no_preset": "Brak dostępnych szablonów.",
            "no_selected_village": "Brak dostępnych wiosek.",
            "no_units": "Brak dostępnych jednostek w wiosce, oczekiwanie na powrót wojsk.",
            "no_units_no_commands": "Brak jednostek w wioskach lub powracających wojsk.",
            "no_villages": "Brak dostępnych wiosek, oczekiwanie na powrót wojsk.",
            "preset_first": "Wybierz najpierw szablon!",
            "selected_village": "Wybrana wioska",
            "loading_targets": "Ładowanie celów...",
            "checking_targets": "Sprawdzanie celów...",
            "restarting_commands": "Restartowanie poleceń...",
            "ignored_village": "Cel %{target} dodany do listy pominiętych.(straty)",
            "included_village": "Cel %{target} dodany do listy zawartych",
            "ignored_village_removed": "usunięty z listy ignorowanych",
            "included_village_removed": "usunięty z listy zawartych",
            "priority_target": "dodany do priorytetowych.",
            "analyse_targets": "Analizowanie celów.",
            "step_cycle_restart": "Restartowanie cyklu poleceń...",
            "step_cycle_end": "Lista wiosek zakończona, oczekiwanie na następny cykl.",
            "step_cycle_end_no_villages": "Brak wiosek do rozpoczęcia cyklu.",
            "step_cycle_next": "Lista wiosek się skończyła, następny cykl: %d.",
            "step_cycle_next_no_villages": "Brak wioski do rozpoczęcia cyklu, następny cykl: %d.",
            "full_storage": "Magazyn w wiosce jest pełny",
            "farm_stopped": "Farmer zatrzymany.",
            "farm_started": "Farmer uruchomiony",
            "groups_presets": "Grupy i szablony",
            "presets": "Szablony",
            "group_ignored": "Pomijaj wioski z grupy",
            "group_include": "Dodaj wioski z grupy",
            "group_only": "Atakuj tylko wioski z grup",
            "attack_interval": "Przerwa między atakami (sekundy)",
            "preserve_command_slots": "Rezerwuj sloty poleceń",
            "target_single_attack": "Zezwól celom na jeden atak per wioska",
            "target_multiple_farmers": "Zezwól celom otrzymywać ataki z kilku wiosek",
            "farmer_cycle_interval": "Przerwa pomiędzy cyklami farmienia (minut)",
            "ignore_on_loss": "Pomijaj cele jeśli straty",
            "ignore_full_storage": "Pomijaj wioski jeśli magazyn pełny",
            "step_cycle_header": "Cykl Farmienia",
            "step_cycle": "Włącz Cykl farmienia",
            "step_cycle_notifs": "Powiadomienia",
            "target_filters": "Filtry celów",
            "min_distance": "Minimalna odległość",
            "max_distance": "Maksymalna odległość",
            "min_points": "Minimalna liczba punktów",
            "max_points": "Maksymalna liczba punktów",
            "max_travel_time": "Maksymalny czas podróży (minuty)",
            "logs_limit": "Maksymalna ilość logów",
            "event_attack": "Logi ataków",
            "event_village_change": "Logi zmiany wiosek",
            "event_priority_add": "Logi celów priorytetowych",
            "event_ignored_village": "Logi pominiętych wiosek",
            "settings_saved": "Ustawienia zapisane!",
            "misc": "Różne",
            "attack": "atakuje",
            "no_logs": "Brak zarejestrowanych logów",
            "clear_logs": "Wyczyść logi",
            "reseted_logs": "Zarejestrowane logi zostały wyczyszczone.",
            "date_added": "Data dodania",
            "multiple_attacks_interval": "Przerwa między atakami (sekundy)",
            "next_cycle_in": "Następny cykl za",
            "target_limit_per_village": "Limit celów na wioskę",
            "settings.hotkeySwitch": "Skrót Start/Pauza",
            "settings.hotkeyWindow": "Skrót okna Farmera",
            "settings.remote": "Sterowanie Zdalne za pomocą wiadomości PW",
            "settingError.minDistance": "Odległość celu musi być większa niż %{min}.",
            "settingError.maxDistance": "Odległość celu nie może przekraczać %{max}.",
            "settingError.maxTravelTime": "Maksymalny czas podróży hh:mm:ss.",
            "settingError.randomBase": "Domyślny odstęp musi być pomiędzy %{min} and %{max}.",
            "settingError.minPoints": "Minimalna liczba punktów celu to %{min}.",
            "settingError.maxPoints": "Maksymalna liczba punktów celu to %{max}.",
            "settingError.eventsLimit": "Liczba zdarzeń musi być wartością między %{min} i %{max}.",
            "langName": "Polski",
            "events.nothingYet": "Odpoczywam...",
            "events.sendCommand": "%{origin} atakuje %{target}",
            "events.priorityTargetAdded": "%{target} dodany do priorytetowych.",
            "general.disabled": "— Wyłączony —",
            "settings.docs": "Miłego farmienia!",
            "settings.settings": "Ustawienia",
            "settings.priorityTargets": "Priorytyzuj cele"
        },
        "minimap": {
            "title": "Minimapa",
            "minimap": "Kartograf",
            "highlights": "Podświetlenie",
            "add": "Dodaj podświetlenie",
            "remove": "Usuń podświetlenie",
            "very_small": "Bardzo mała",
            "small": "Mała",
            "big": "Duża",
            "very_big": "Bardzo duża",
            "placeholder_search": "Szukaj gracz/plemię",
            "highlight_add_success": "Podświetlenie dodane",
            "highlight_add_error": "Najpierw sprecyzuj podświetlenie",
            "highlight_update_success": "Podświetlenie zaktualizowane",
            "highlight_remove_success": "Podświetlenie usunięte",
            "highlight_villages": "Wioski",
            "highlight_players": "Gracze",
            "highlight_tribes": "Plemiona",
            "highlight_add_error_exists": "Podświetlenie już istnieje!",
            "highlight_add_error_no_entry": "Najpierw wybierz gracza/plemię!",
            "highlight_add_error_invalid_color": "Nieprawidłowy kolor!",
            "village": "Wioska",
            "player": "Gracz",
            "tribe": "Plemię",
            "color": "Kolor (Hex)",
            "tooltip_pick_color": "Wybierz kolor",
            "misc": "Pozostałe ustawienia",
            "colors_misc": "Różne kolory",
            "colors_diplomacy": "Dyplomacja - kolory",
            "settings_saved": "Ustawienia zapisane!",
            "settings_map_size": "Rozmiar mapy",
            "settings_right_click_action": "PPM aby wykonać działanie na wiosce",
            "highlight_village": "Podświetl wioskę",
            "highlight_player": "Podświetl gracza",
            "highlight_tribe": "Podświetl plemie",
            "settings_show_floating_minimap": "Pokaż ruchomą mapę",
            "settings_show_view_reference": "Pokaż wskaźnik obecnej pozycji",
            "settings_show_continent_demarcations": "Pokaż granice królestw",
            "settings_show_province_demarcations": "Pokaż granice prowincji",
            "settings_show_barbarians": "Pokaż wioski barbarzyńskie",
            "settings_show_ghost_villages": "Pokaż niezaładowane wioski",
            "settings_show_only_custom_highlights": "Pokaż tylko własne podświetlenia",
            "settings_highlight_own": "Podświetl własne wioski",
            "settings_highlight_selected": "Podświetl wybraną wioskę",
            "settings_highlight_diplomacy": "Automatycznie podświetl plemienną dyplomację",
            "settings_colors_background": "Tło minimapy",
            "settings_colors_province": "Granica prowincji",
            "settings_colors_continent": "Granica królestwa",
            "settings_colors_quick_highlight": "Szybkie podświetlenie",
            "settings_colors_tribe": "Własne plemie",
            "settings_colors_player": "Własne wioski",
            "settings_colors_selected": "Wybrana wioska",
            "settings_colors_ghost": "Niezaładowana wioska",
            "settings_colors_ally": "Sojusznik",
            "settings_colors_pna": "PON",
            "settings_colors_enemy": "Wróg",
            "settings_colors_other": "Pozostałe wioski graczy",
            "settings_colors_barbarian": "Wioski barbarzyńskie",
            "settings_colors_view_reference": "Wskaźnik obecnej pozycji",
            "settings_reset": "Ustawienia zresetowane",
            "tooltip_village": "Wioska",
            "tooltip_village_points": "Punkty wioski",
            "tooltip_player": "Nazwa gracza",
            "tooltip_player_points": "Punkty gracza",
            "tooltip_tribe": "Plemię",
            "tooltip_tribe_points": "Punkty plemienia",
            "tooltip_province": "Prowincja",
            "no_highlights": "Brak utworzonych podświetleń",
            "reset_confirm_title": "Resetuj ustawienia",
            "reset_confirm_text": "Wszystkie ustawienia zostaną przywrócone do domyślnych.",
            "reset_confirm_highlights_text": "Jak również wszystkie podświetlenia zostaną usunięte.",
            "default_village_colors_info": "Informacje o domyślnych kolorach wiosek",
            "entry/id": "Wioska/gracz/plemie",
            "tooltip.village-id": "Id wioski",
            "tooltip.player-id": "Id gracza",
            "tooltip.tribe-id": "Id plemienia"
        },
        "mint_helper": {
            "title": "Mincerz",
            "description": "Automatycznie wybija monety gdy włączony.",
            "activated": "Mincerz aktywowany",
            "deactivated": "Mincerz deaktywowany"
        },
        "preset_creator": {
            "title": "Kwatermistrz",
            "description": "Automatycznie tworzy szablony do rekrutacji, fejków i farmy.",
            "activated": "Kwatermistrz aktywowany",
            "done": "Kwatermistrz utworzył szablony",
            "deactivated": "Kwatermistrz skończył działanie"
        },
        "recruit_queue": {
            "title": "Kapitan",
            "clearL": "Wyczyść logi",
            "start": "Rekrutuj",
            "logs.noRecruits": "Nie rozpoczęto żadnych rekrutacji",
            "amount": "Ilość",
            "unit": "Jednostka",
            "recruit.own": "Rekrutacja wg własnych ustawień",
            "recruit.presets": "Rekrutacja z szablonów",
            "presets": "Szablonowa",
            "own": "Własne ustawienia",
            "logs": "Logi",
            "group": "Grupa wiosek",
            "preset": "Szablon cząstkowy",
            "presetfinal": "Szablon docelowy",
            "spear": "Pikinier",
            "sword": "Miecznik",
            "axe": "Topornik",
            "archer": "Łucznik",
            "light_cavalry": "Lekki kawalerzysta",
            "mounted_archer": "Łucznik konny",
            "heavy_cavalry": "Ciężki kawalerzysta",
            "ram": "Taran",
            "catapult": "Katapulta",
            "doppelsoldner": "Berserker",
            "trebuchet": "Trebusz",
            "snob": "Szlachcic",
            "knight": "Rycerz",
            "general.started": "Kapitan Uruchomiony!",
            "general.stopped": "Kapitan Zatrzymany!",
            "clear": "Wyczyść"
        },
        "report_sender": {
            "title": "Goniec",
            "description": "Automatycznie wysyła raporty z misji szpiegowskich, ataków oraz wsparć tworząc odpowiednie wiadomości.",
            "activated": "Goniec aktywowany",
            "deactivated": "Goniec skończył działanie"
        },
        "spy_master": {
            "title": "Zwiadowca",
            "spy": "Akcje Szpiegowskie",
            "recruit": "Auto-Rekrutacja",
            "countermeasures": "Kontrwywiad",
            "torpedo": "Cel misji szpiegowskich",
            "spyU": "Szpieguj jednostki",
            "spyB": "Szpieguj budynki",
            "spyA": "Efektywne szpiegowanie",
            "spyP": "Szpieguj całego gracza",
            "sabotage": "Sabotuj wioskę",
            "spyU.text": "Wysyła 7 szpiegów z twoich wiosek na wioskę wskazaną aby zdobyć informacje tylko p jednostkach.",
            "spyB.text": "Wysyła 7 szpiegów z twoich wiosek na wioskę wskazaną aby zdobyć informacje tylko o budynkach.",
            "sabotage.text": "Wysyła po 3 szpiegów z twoich wiosek na wioskę wskazaną aby dokonać sabotażu na budynkach.",
            "spyA.text": "Wysyła 8-10 szpiegów z twoich wiosek na wioskę wskazaną aby zdobyć informacje o budynkach oraz jednostkach(pierwsi szpiedzy na budynki ostatni na jednostki).",
            "spyP.text": "Wysyła szpiegów z twoich wiosek na wioski gracza aby zdobyć informacje o budynkach oraz jednostkach(pierwsi szpiedzy na budynki ostatni na jednostki).",
            "send": "Wyślij",
            "sabote": "Sabotuj",
            "sendingU": "Wszyscy na jednostki",
            "sendingB": "Wszyscy na budynki",
            "sendingS": "3 do sabotowania budynków na wrogiej wiosce",
            "sendingA": "Pierwsi na budynki kolejni na jednsotki - największa efektwnosc.",
            "sendingP": "Pierwsi na budynki kolejni na jednsotki - największa efektwnosc.",
            "entry/id": "Gracz",
            "entry/vid": "Wioska",
            "entry/building": "Wpisz budynek",
            "entry/level": "Wpisz poziom",
            "entry/unit": "Jednostka",
            "entry/replacement": "Zamiennik",
            "recruiting": "Rekrutacja",
            "recruit.text": "Rekrutuje wszystkich szpiegów na wszystkich wioskach.",
            "recruit.tip": "xxx",
            "recruit.btn": "Rekrutuj",
            "camouflage": "Kamuflaż",
            "camouflage.text": "Wybierz budynek oraz poziom jaki ma być widoczny dla wrogiego szpiega.",
            "camouflage.tip": "Zmienia widoczność poziomu wybranego budynku na wszystkich wioskach gdzie jest dostępna opcja kamuflażu",
            "camouflage.btn": "Kamufluj",
            "camouflage.set": "Kamuflaż ustawiony.",
            "switch": "Zamiana broni",
            "switch.text": "Wybierz typy jednostek które zamienią się bronią by oszukać wrogiego szpiega.",
            "switch.tip": "Zamienia broń między dwoma typami jednostek na wszystkich wioskach, na których jest to możliwe.",
            "switch.btn": "Zamień",
            "switch.set": "Zamiana broni ustawiona.",
            "dummies": "Atrapy",
            "dummies.text": "Wybierz jednostkę, która ma posłużyć jako atrapa widoczna dla wrogiego szpiega.",
            "dummies.tip": "Aktywuje Atrapy, uzupełnia wolny prowiant o wybrane jednotski na wszystkich wioskach gdzie są one dostępne.",
            "dummies.btn": "Postaw",
            "dummies.set": "Atrapy postawione.",
            "exchange": "Wymiana",
            "exchange.text": "Dzięki tej opcji wrogi szpieg pozostawi raport na temat swojej własnej wioski.",
            "exchange.tip": "Aktywuje Wymianę na wszystkich wioskach gdzie jest ona dostępna.",
            "exchange.btn": "Aktywuj",
            "exchange.set": "Wymiana ustawiona.",
            "general.stopped": "Zwiadowca zatrzymany",
            "general.started": "Zwiadowca uruchomiony",
            "origin": "Wioska źródłowa",
            "target": "Wioska cel",
            "type": "Typ",
            "amount": "Ilość",
            "date": "Czas wysłania",
            "clear": "Wyczyść",
            "logs": "Logi",
            "logs.clear": "Wyczyść logi",
            "logs.noMissions": "Brak wysłanych szpiegów.",
            "headquarter": "Ratusz",
            "barracks": "Koszary",
            "tavern": "Tawerna",
            "hospital": "Szpital",
            "preceptory": "Komturia",
            "chapel": "Kaplica",
            "church": "Kościół",
            "academy": "Akademia",
            "rally_point": "Plac",
            "statue": "Piedestał",
            "market": "Rynek",
            "timber_camp": "Tartak",
            "clay_pit": "Kopalnia gliny",
            "iron_mine": "Huta żelaza",
            "farm": "Farma",
            "warehouse": "Magazyn",
            "wall": "Mur",
            "spear": "Pikinier",
            "sword": "Miecznik",
            "axe": "Topornik",
            "archer": "Łucznik",
            "light_cavalry": "Lekki kawalerzysta",
            "mounted_archer": "Łucznik konny",
            "heavy_cavalry": "Ciężki kawalerzysta",
            "ram": "Taran",
            "catapult": "Katapulta",
            "doppelsoldner": "Berserker",
            "trebuchet": "Trebusz",
            "snob": "Szlachcic",
            "knight": "Rycerz",
            "none": "-- Wyłączona --"
        },
        "spy_recruiter": {
            "title": "Szpieg",
            "description": "Automatycznie rekrutuje szpiegów jesli brak na wioskach.",
            "activated": "Szpieg aktywowany",
            "deactivated": "Szpieg skończył działanie",
            "revived": "Szpiedzy dodani do kolejki rekrutacji"
        },
        "common": {
            "start": "Start",
            "started": "Uruchomiony",
            "pause": "Pauza",
            "paused": "Wstrzymany",
            "stop": "Zatrzymany",
            "stopped": "Zatrzymany",
            "status": "Status",
            "none": "Żaden",
            "info": "Informacje",
            "settings": "Ustawienia",
            "others": "Inne",
            "village": "Wioska",
            "villages": "Wioski",
            "building": "Budynek",
            "buildings": "Budynki",
            "level": "Poziom",
            "registers": "Rejestry",
            "filters": "Filtry",
            "add": "Dodaj",
            "waiting": "Oczekujące",
            "attack": "Atak",
            "support": "Wsparcie",
            "relocate": "Przeniesienie",
            "activate": "Aktywuj",
            "deactivate": "Wyłącz",
            "units": "Jednostki",
            "officers": "Oficerowie",
            "origin": "Źródło",
            "target": [
                "Cel",
                "Cele"
            ],
            "save": "Zapisz",
            "logs": "Logi",
            "no-results": "Brak wyników...",
            "selected": "Wybrana",
            "now": "Teraz",
            "costs": "Koszty",
            "duration": "Czas",
            "points": "Punkty",
            "player": "Gracz",
            "players": "Gracze",
            "next_features": "Następne funkcje",
            "misc": "Różne",
            "colors": "Kolory",
            "reset": "Resetuj",
            "here": "tutaj",
            "disabled": "— Wyłączony —",
            "cancel": "Anuluj",
            "actions": "Akcje",
            "remove": "Usuń",
            "started_at": "Uruchomiony",
            "arrive": "Dotarcie",
            "settings_saved": "Ustawienia zapisane",
            "discard": "Odrzuć",
            "new_version": "Nowa wersja",
            "check_changes": "Sprawdź zmiany",
            "headquarter": "Ratusz",
            "barracks": "Koszary",
            "tavern": "Tawerna",
            "hospital": "Szpital",
            "preceptory": "Komturia",
            "chapel": "Kaplica",
            "church": "Kościół",
            "academy": "Akademia",
            "rally_point": "Plac",
            "statue": "Piedestał",
            "market": "Rynek",
            "timber_camp": "Tartak",
            "clay_pit": "Kopalnia gliny",
            "iron_mine": "Huta żelaza",
            "farm": "Farma",
            "warehouse": "Magazyn",
            "wall": "Mur",
            "spear": "Pikinier",
            "sword": "Miecznik",
            "axe": "Topornik",
            "archer": "Łucznik",
            "light_cavalry": "Lekki kawalerzysta",
            "mounted_archer": "Łucznik konny",
            "heavy_cavalry": "Ciężki kawalerzysta",
            "ram": "Taran",
            "catapult": "Katapulta",
            "doppelsoldner": "Berserker",
            "trebuchet": "Trebusz",
            "snob": "Szlachcic",
            "knight": "Rycerz",
            "firefox_shill": ""
        }
    }
} // eslint-disable-line
    const DEFAULT_LANG = 'en_us'
    const SHARED_LANGS = {
        'en_dk': 'en_us',
        'pt_pt': 'pt_br'
    }

    function selectLanguage (langId) {
        langId = hasOwn.call(SHARED_LANGS, langId) ? SHARED_LANGS[langId] : langId
        i18n.setJSON(languages[langId] || languages[DEFAULT_LANG])
    }

    let twoLanguage = {}

    twoLanguage.init = function () {
        if (initialized) {
            return false
        }

        initialized = true
        
        selectLanguage($rootScope.loc.ale)

        // trigger eventTypeProvider.LANGUAGE_SELECTED_CHANGED you dumb fucks
        $rootScope.$watch('loc.ale', function (newValue, oldValue) {
            if (newValue !== oldValue) {
                selectLanguage($rootScope.loc.ale)
            }
        })
    }

    return twoLanguage
})

define('two/Settings', [
    'two/utils',
    'Lockr'
], function (
    utils,
    Lockr
) {
    const generateDiff = function (before, after) {
        let changes = {}

        for (let id in before) {
            if (hasOwn.call(after, id)) {
                if (!angular.equals(before[id], after[id])) {
                    changes[id] = after[id]
                }
            } else {
                changes[id] = before[id]
            }
        }

        return angular.equals({}, changes) ? false : changes
    }

    const generateDefaults = function (map) {
        let defaults = {}

        for (let key in map) {
            defaults[key] = map[key].default
        }

        return defaults
    }

    const disabledOption = function () {
        return {
            name: $filter('i18n')('disabled', $rootScope.loc.ale, 'common'),
            value: false
        }
    }

    const getUpdates = function (map, changes) {
        let updates = {}

        for (let id in changes) {
            (map[id].updates || []).forEach(function (updateItem) {
                updates[updateItem] = true
            })
        }

        if (angular.equals(updates, {})) {
            return false
        }

        return updates
    }

    let Settings = function (configs) {
        this.settingsMap = configs.settingsMap
        this.storageKey = configs.storageKey
        this.defaults = generateDefaults(this.settingsMap)
        this.settings = angular.merge({}, this.defaults, Lockr.get(this.storageKey, {}))
        this.events = {
            settingsChange: configs.onChange || noop
        }
        this.injected = false
    }

    Settings.prototype.get = function (id) {
        return angular.copy(this.settings[id])
    }

    Settings.prototype.getAll = function () {
        return angular.copy(this.settings)
    }

    Settings.prototype.getDefault = function (id) {
        return hasOwn.call(this.defaults, id) ? this.defaults[id] : undefined
    }

    Settings.prototype.store = function () {
        Lockr.set(this.storageKey, this.settings)
    }

    Settings.prototype.set = function (id, value, opt) {
        if (!hasOwn.call(this.settingsMap, id)) {
            return false
        }

        const map = this.settingsMap[id]
        
        if (map.inputType === 'number') {
            value = parseInt(value, 10)

            if (hasOwn.call(map, 'min')) {
                value = Math.max(map.min, value)
            }

            if (hasOwn.call(map, 'max')) {
                value = Math.min(map.max, value)
            }
        }

        const before = angular.copy(this.settings)
        this.settings[id] = value
        const after = angular.copy(this.settings)
        const changes = generateDiff(before, after)

        if (!changes) {
            return false
        }

        const updates = getUpdates(this.settingsMap, changes)

        this.store()
        this.updateScope()
        this.events.settingsChange.call(this, changes, updates, opt || {})

        return true
    }

    Settings.prototype.setAll = function (values, opt) {
        const before = angular.copy(this.settings)

        for (let id in values) {
            if (hasOwn.call(this.settingsMap, id)) {
                const map = this.settingsMap[id]
                let value = values[id]

                if (map.inputType === 'number') {
                    value = parseInt(value, 10)

                    if (hasOwn.call(map, 'min')) {
                        value = Math.max(map.min, value)
                    }

                    if (hasOwn.call(map, 'max')) {
                        value = Math.min(map.max, value)
                    }
                }

                this.settings[id] = value
            }
        }

        const after = angular.copy(this.settings)
        const changes = generateDiff(before, after)

        if (!changes) {
            return false
        }

        const updates = getUpdates(this.settingsMap, changes)

        this.store()
        this.updateScope()
        this.events.settingsChange.call(this, changes, updates, opt || {})

        return true
    }

    Settings.prototype.reset = function (id, opt) {
        this.set(id, this.defaults[id], opt)

        return true
    }

    Settings.prototype.resetAll = function (opt) {
        this.setAll(angular.copy(this.defaults), opt)

        return true
    }

    Settings.prototype.each = function (callback) {
        for (let id in this.settings) {
            if (!hasOwn.call(this.settingsMap, id)) {
                continue
            }
            
            let map = this.settingsMap[id]

            if (map.inputType === 'checkbox') {
                callback.call(this, id, !!this.settings[id], map)
            } else {
                callback.call(this, id, this.settings[id], map)
            }
        }
    }

    Settings.prototype.onChange = function (callback) {
        if (typeof callback === 'function') {
            this.events.settingsChange = callback
        }
    }

    Settings.prototype.injectScope = function ($scope, opt) {
        this.injected = {
            $scope: $scope,
            opt: opt
        }

        $scope.settings = this.encode(opt)

        utils.each(this.settingsMap, function (map, id) {
            if (map.inputType === 'select') {
                $scope.$watch(function () {
                    return $scope.settings[id]
                }, function (value) {
                    if (map.multiSelect) {
                        if (!value.length) {
                            $scope.settings[id] = [disabledOption()]
                        }
                    } else if (!value) {
                        $scope.settings[id] = disabledOption()
                    }
                }, true)
            }
        })
    }

    Settings.prototype.updateScope = function () {
        if (!this.injected) {
            return false
        }

        this.injected.$scope.settings = this.encode(this.injected.opt)
    }

    Settings.prototype.encode = function (opt) {
        let encoded = {}
        const presets = modelDataService.getPresetList().getPresets()
        const groups = modelDataService.getGroupList().getGroups()

        opt = opt || {}

        this.each(function (id, value, map) {
            if (map.inputType === 'select') {
                if (!value && map.disabledOption) {
                    encoded[id] = map.multiSelect ? [disabledOption()] : disabledOption()
                    return
                }

                switch (map.type) {
                    case 'presets': {
                        if (map.multiSelect) {
                            let multiValues = []

                            value.forEach(function (presetId) {
                                if (!presets[presetId]) {
                                    return
                                }

                                multiValues.push({
                                    name: presets[presetId].name,
                                    value: presetId
                                })
                            })

                            encoded[id] = multiValues.length ? multiValues : [disabledOption()]
                        } else {
                            if (!presets[value] && map.disabledOption) {
                                encoded[id] = disabledOption()
                                return
                            }

                            encoded[id] = {
                                name: presets[value].name,
                                value: value
                            }
                        }

                        break
                    }
                    case 'groups': {
                        if (map.multiSelect) {
                            let multiValues = []

                            value.forEach(function (groupId) {
                                if (!groups[groupId]) {
                                    return
                                }

                                multiValues.push({
                                    name: groups[groupId].name,
                                    value: groupId,
                                    leftIcon: groups[groupId].icon
                                })
                            })

                            encoded[id] = multiValues.length ? multiValues : [disabledOption()]
                        } else {
                            if (!groups[value] && map.disabledOption) {
                                encoded[id] = disabledOption()
                                return
                            }

                            encoded[id] = {
                                name: groups[value].name,
                                value: value
                            }
                        }

                        break
                    }
                    default: {
                        encoded[id] = {
                            name: opt.textObject ? $filter('i18n')(value, $rootScope.loc.ale, opt.textObject) : value,
                            value: value
                        }

                        if (opt.multiSelect) {
                            encoded[id] = [encoded[id]]
                        }

                        break
                    }
                }
            } else {
                encoded[id] = value
            }
        })

        return encoded
    }

    Settings.prototype.decode = function (encoded) {
        let decoded = {}

        for (let id in encoded) {
            let map = this.settingsMap[id]

            if (map.inputType === 'select') {
                if (map.multiSelect) {
                    if (encoded[id].length === 1 && encoded[id][0].value === false) {
                        decoded[id] = []
                    } else {
                        let multiValues = []

                        encoded[id].forEach(function (item) {
                            multiValues.push(item.value)
                        })

                        decoded[id] = multiValues
                    }
                } else {
                    decoded[id] = encoded[id].value
                }
            } else {
                decoded[id] = encoded[id]
            }
        }

        return decoded
    }

    Settings.encodeList = function (list, opt) {
        let encoded = []

        opt = opt || {}

        if (opt.disabled) {
            encoded.push(disabledOption())
        }

        switch (opt.type) {
            case 'keys': {
                for (let prop in list) {
                    encoded.push({
                        name: prop,
                        value: prop
                    })
                }

                break
            }
            case 'groups': {
                for (let prop in list) {
                    let value = list[prop]

                    encoded.push({
                        name: value.name,
                        value: value.id,
                        leftIcon: value.icon
                    })
                }

                break
            }
            case 'presets': {
                for (let prop in list) {
                    let value = list[prop]

                    encoded.push({
                        name: value.name,
                        value: value.id
                    })
                }

                break
            }
            case 'values':
            default: {
                for (let prop in list) {
                    let value = list[prop]

                    encoded.push({
                        name: opt.textObject ? $filter('i18n')(value, $rootScope.loc.ale, opt.textObject) : value,
                        value: value
                    })
                }
            }
        }

        return encoded
    }

    Settings.disabledOption = disabledOption

    return Settings
})

define('two/mapData', [
    'conf/conf'
], function (
    conf
) {
    let villages = []
    let grid = []
    let loading = false
    let loaded = false
    let callbackQueue = []
    const MINIMAP_WIDTH = 306
    const MINIMAP_HEIGHT = 306

    angular.extend(eventTypeProvider, {
        MAP_DATA_LOADED: 'map_data_loaded'
    })

    const init = function () {
        const xChunks = Math.ceil(conf.MAP_SIZE / MINIMAP_WIDTH)
        const yChunks = Math.ceil(conf.MAP_SIZE / MINIMAP_HEIGHT)

        for (let gridX = 0; gridX < xChunks; gridX++) {
            grid.push([])

            let chunkX = MINIMAP_WIDTH * gridX
            let chunkWidth = MINIMAP_WIDTH.bound(0, chunkX + MINIMAP_WIDTH).bound(0, conf.MAP_SIZE - chunkX)
            chunkX = chunkX.bound(0, conf.MAP_SIZE)

            for (let gridY = 0; gridY < yChunks; gridY++) {
                let chunkY = MINIMAP_HEIGHT * gridY
                let chunkHeight = MINIMAP_HEIGHT.bound(0, chunkY + MINIMAP_HEIGHT).bound(0, conf.MAP_SIZE - chunkY)
                chunkY = chunkY.bound(0, conf.MAP_SIZE)

                grid[gridX].push({
                    x: chunkX,
                    y: chunkY,
                    width: chunkWidth,
                    height: chunkHeight
                })
            }
        }
    }

    let twoMapData = {}

    twoMapData.load = function (callback = noop, force) {
        if (force) {
            loaded = false
        } else if (loading) {
            return callbackQueue.push(callback)
        } else if (loaded) {
            return callback(villages)
        }

        callbackQueue.push(callback)
        loading = true
        let cells = []

        for (let gridX = 0; gridX < grid.length; gridX++) {
            for (let gridY = 0; gridY < grid[gridX].length; gridY++) {
                cells.push(grid[gridX][gridY])
            }
        }

        let requests = []

        cells.forEach(function (cell) {
            let promise = new Promise(function (resolve, reject) {
                socketService.emit(routeProvider.MAP_GET_MINIMAP_VILLAGES, cell, function (data) {
                    if (data.message) {
                        return reject(data.message)
                    }

                    if (data.villages.length) {
                        villages = villages.concat(data.villages)
                    }

                    resolve()
                })
            })

            requests.push(promise)
        })

        return Promise.all(requests).then(function () {
            loading = false
            loaded = true

            $rootScope.$broadcast(eventTypeProvider.MAP_DATA_LOADED)
            
            callbackQueue.forEach(function (queuedCallback) {
                queuedCallback(villages)
            })

            callbackQueue = []
        }).catch(function (error) {
            // eslint-disable-next-line no-console
            console.error(error.message)
        })
    }

    twoMapData.getVillages = function () {
        return villages
    }

    twoMapData.isLoaded = function () {
        return loaded
    }

    init()

    return twoMapData
})

define('two/ui', [
    'conf/conf',
    'conf/cdn',
    'two/ready'
], function (
    conf,
    cdnConf,
    ready
) {
    let interfaceOverflow = {}
    let templates = {}
    let initialized = false
    let $menu
    let $menu2
    let $menu3
    let $menu4

    let $head = document.querySelector('head')
    let httpService = injector.get('httpService')
    let templateManagerService = injector.get('templateManagerService')
    let $templateCache = injector.get('$templateCache')

    templateManagerService.load = function (templateName, onSuccess, opt_onError) {
        let path

        const success = function (data, status, headers, config) {
            $templateCache.put(path.substr(1), data)

            if (angular.isFunction(onSuccess)) {
                onSuccess(data, status, headers, config)
            }

            if (!$rootScope.$$phase) {
                $rootScope.$apply()
            }
        }

        const error = function (data, status, headers, config) {
            if (angular.isFunction(opt_onError)) {
                opt_onError(data, status, headers, config)
            }
        }

        if (0 !== templateName.indexOf('!')) {
            path = conf.TEMPLATE_PATH_EXT.join(templateName)
        } else {
            path = templateName.substr(1)
        }

        if ($templateCache.get(path.substr(1))) {
            success($templateCache.get(path.substr(1)), 304)
        } else {
            if (cdnConf.versionMap[path]) {
                httpService.get(path, success, error)
            } else {
                success(templates[path], 304)
            }
        }
    }

    interfaceOverflow.init = function () {
        if (initialized) {
            return false
        }

        let $wrapper = document.querySelector('#wrapper')
        let $container = document.createElement('div')
        let $container2 = document.createElement('div')
        let $container3 = document.createElement('div')
        let $container4 = document.createElement('div')
        let $mainButton = document.createElement('div')
        let $mainButton2 = document.createElement('div')
        let $mainButton3 = document.createElement('div')
        let $mainButton4 = document.createElement('div')

        $container.className = 'two-menu-container'
        $wrapper.appendChild($container)
        $container2.className = 'two-menu-container2'
        $wrapper.appendChild($container2)
        $container3.className = 'two-menu-container3'
        $wrapper.appendChild($container3)
        $container4.className = 'two-menu-container4'
        $wrapper.appendChild($container4)

        $mainButton.className = 'two-main-button'
        $mainButton.style.display = 'none'
        $mainButton2.className = 'two-economy-button'
        $mainButton2.style.display = 'none'
        $mainButton3.className = 'two-intrigue-button'
        $mainButton3.style.display = 'none'
        $mainButton4.className = 'two-other-button'
        $mainButton4.style.display = 'none'
        $container.appendChild($mainButton)
        $container2.appendChild($mainButton2)
        $container3.appendChild($mainButton3)
        $container4.appendChild($mainButton4)

        $menu = document.createElement('div')
        $menu.className = 'two-menu'
        $container.appendChild($menu)
        $menu2 = document.createElement('div')
        $menu2.className = 'two-menu2'
        $container2.appendChild($menu2)
        $menu3 = document.createElement('div')
        $menu3.className = 'two-menu3'
        $container3.appendChild($menu3)
        $menu4 = document.createElement('div')
        $menu4.className = 'two-menu4'
        $container4.appendChild($menu4)

        initialized = true
        interfaceOverflow.addStyle('.two-window a.select-handler{-webkit-box-shadow:none;box-shadow:none}.two-window .small-select a.select-handler{height:22px;line-height:22px}.two-window .small-select a.select-button{height:22px}.two-window input::placeholder{color:rgba(255,243,208,0.7)}.two-window .green{color:#07770b}.two-window .red{color:#770707}.two-window .blue{color:#074677}.two-menu-container{position:absolute;top:84px;left:84px;width:90px;z-index:10}.two-menu-container:hover .two-main-button{background-position:0 -75px}.two-menu-container:hover .two-menu{opacity:1;visibility:visible;transition:opacity .1s ease-in-out}.two-menu-container3{position:absolute;top:252px;left:84px;width:90px;z-index:10}.two-menu-container3:hover .two-intrigue-button{background-position:0 -75px}.two-menu-container3:hover .two-menu3{opacity:1;visibility:visible;transition:opacity .1s ease-in-out}.two-menu-container4{position:absolute;top:336px;left:84px;width:90px;z-index:10}.two-menu-container4:hover .two-other-button{background-position:0 -75px}.two-menu-container4:hover .two-menu4{opacity:1;visibility:visible;transition:opacity .1s ease-in-out}.two-menu-container2{position:absolute;top:168px;left:84px;width:90px;z-index:10}.two-menu-container2:hover .two-economy-button{background-position:0 -75px}.two-menu-container2:hover .two-menu2{opacity:1;visibility:visible;transition:opacity .1s ease-in-out}.two-main-button{left:0;width:75px;height:75px;background-image:url("data:image/png;base64,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");background-position:0 0;z-index:10}.two-economy-button{left:0px;width:75px;height:75px;background-image:url("data:image/png;base64,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");background-position:0 0;z-index:10}.two-intrigue-button{left:0px;width:75px;height:75px;background-image:url("data:image/png;base64,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");background-position:0 0;z-index:10}.two-other-button{left:0px;width:75px;height:75px;background-image:url("data:image/png;base64,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");background-position:0 0;z-index:10}.two-menu{position:absolute;top:0;left:84px;width:120px;display:flex;flex-flow:wrap;visibility:hidden;opacity:0;z-index:10}.two-menu .button{height:24px;width:150px;padding:0 15px;line-height:22px;margin-bottom:8px}.two-menu .divisor{height:3px;margin-bottom:5px;background:linear-gradient(90deg, #4e2e1a, transparent);border-radius:10px;width:100%}.two-menu2{position:absolute;top:0;left:84px;width:120px;display:flex;flex-flow:wrap;visibility:hidden;opacity:0;z-index:10}.two-menu2 .button{height:24px;width:150px;padding:0 15px;line-height:22px;margin-bottom:8px}.two-menu2 .divisor{height:3px;margin-bottom:5px;background:linear-gradient(90deg, #4e2e1a, transparent);border-radius:10px;width:100%}.two-menu3{position:absolute;top:0;left:84px;width:120px;display:flex;flex-flow:wrap;visibility:hidden;opacity:0;z-index:10}.two-menu3 .button{height:24px;width:150px;padding:0 15px;line-height:22px;margin-bottom:8px}.two-menu3 .divisor{height:3px;margin-bottom:5px;background:linear-gradient(90deg, #4e2e1a, transparent);border-radius:10px;width:100%}.two-menu4{position:absolute;top:0;left:84px;width:120px;display:flex;flex-flow:wrap;visibility:hidden;opacity:0;z-index:10}.two-menu4 .button{height:24px;width:150px;padding:0 15px;line-height:22px;margin-bottom:8px}.two-menu4 .divisor{height:3px;margin-bottom:5px;background:linear-gradient(90deg, #4e2e1a, transparent);border-radius:10px;width:100%}#wrapper.window-open .two-menu-container{left:797px}#wrapper.window-open .two-menu-container2{left:797px}#wrapper.window-open .two-menu-container3{left:797px}#wrapper.window-open .two-menu-container4{left:797px}#wrapper.window-open.window-fullsize .two-menu-container{display:none !important}#wrapper.window-open.window-fullsize .two-menu-container2{display:none !important}#wrapper.window-open.window-fullsize .two-menu-container3{display:none !important}#wrapper.window-open.window-fullsize .two-menu-container4{display:none !important}input:not([type]){border:none;outline:none}a.link{font-weight:bold;color:#3f2615}a.link:hover{text-shadow:0 1px 0 #000;color:#fff}')

        ready(function () {
            $mainButton.style.display = 'block'
            $mainButton2.style.display = 'block'
            $mainButton3.style.display = 'block'
            $mainButton4.style.display = 'block'
        }, ['map'])
    }

    interfaceOverflow.addTemplate = function (path, data) {
        templates[path] = data
    }

    interfaceOverflow.addStyle = function (styles) {
        let $style = document.createElement('style')
        $style.type = 'text/css'
        $style.appendChild(document.createTextNode(styles))
        $head.appendChild($style)
    }

    interfaceOverflow.addMenuButton = function (label, order, _tooltip) {
        let $button = document.createElement('div')
        $button.className = 'btn-border btn-orange button'
        $button.innerHTML = label
        $button.style.order = order
        $menu.appendChild($button)

        if (typeof _tooltip === 'string') {
            $button.addEventListener('mouseenter', function (event) {
                $rootScope.$broadcast(eventTypeProvider.TOOLTIP_SHOW, 'twoverflow-tooltip', _tooltip, true, event)
            })

            $button.addEventListener('mouseleave', function () {
                $rootScope.$broadcast(eventTypeProvider.TOOLTIP_HIDE, 'twoverflow-tooltip')
            })
        }

        return $menu.appendChild($button)
    }

    interfaceOverflow.addMenuButton2 = function (label, order, _tooltip) {
        let $button = document.createElement('div')
        $button.className = 'btn-border btn-orange button'
        $button.innerHTML = label
        $button.style.order = order
        $menu2.appendChild($button)

        if (typeof _tooltip === 'string') {
            $button.addEventListener('mouseenter', function (event) {
                $rootScope.$broadcast(eventTypeProvider.TOOLTIP_SHOW, 'twoverflow-tooltip', _tooltip, true, event)
            })

            $button.addEventListener('mouseleave', function () {
                $rootScope.$broadcast(eventTypeProvider.TOOLTIP_HIDE, 'twoverflow-tooltip')
            })
        }

        return $menu2.appendChild($button)
    }

    interfaceOverflow.addMenuButton3 = function (label, order, _tooltip) {
        let $button = document.createElement('div')
        $button.className = 'btn-border btn-orange button'
        $button.innerHTML = label
        $button.style.order = order
        $menu3.appendChild($button)

        if (typeof _tooltip === 'string') {
            $button.addEventListener('mouseenter', function (event) {
                $rootScope.$broadcast(eventTypeProvider.TOOLTIP_SHOW, 'twoverflow-tooltip', _tooltip, true, event)
            })

            $button.addEventListener('mouseleave', function () {
                $rootScope.$broadcast(eventTypeProvider.TOOLTIP_HIDE, 'twoverflow-tooltip')
            })
        }

        return $menu3.appendChild($button)
    }

    interfaceOverflow.addMenuButton4 = function (label, order, _tooltip) {
        let $button = document.createElement('div')
        $button.className = 'btn-border btn-orange button'
        $button.innerHTML = label
        $button.style.order = order
        $menu4.appendChild($button)

        if (typeof _tooltip === 'string') {
            $button.addEventListener('mouseenter', function (event) {
                $rootScope.$broadcast(eventTypeProvider.TOOLTIP_SHOW, 'twoverflow-tooltip', _tooltip, true, event)
            })

            $button.addEventListener('mouseleave', function () {
                $rootScope.$broadcast(eventTypeProvider.TOOLTIP_HIDE, 'twoverflow-tooltip')
            })
        }

        return $menu4.appendChild($button)
    }

    interfaceOverflow.addDivisor = function (order) {
        let $div = document.createElement('div')
        $div.className = 'divisor'
        $div.style.order = order
        $menu.appendChild($div)
    }
    interfaceOverflow.addDivisor2 = function (order) {
        let $div = document.createElement('div')
        $div.className = 'divisor'
        $div.style.order = order
        $menu2.appendChild($div)
    }
    interfaceOverflow.addDivisor3 = function (order) {
        let $div = document.createElement('div')
        $div.className = 'divisor'
        $div.style.order = order
        $menu3.appendChild($div)
    }
    interfaceOverflow.addDivisor4 = function (order) {
        let $div = document.createElement('div')
        $div.className = 'divisor'
        $div.style.order = order
        $menu4.appendChild($div)
    }

    interfaceOverflow.isInitialized = function () {
        return initialized
    }

    return interfaceOverflow
})

require([
    'two/ui'
], function (interfaceOverflow) {
    if (interfaceOverflow.isInitialized()) {
        return false
    }

    interfaceOverflow.init()
})

require([
    'two/language',
    'two/ready',
    'Lockr'
], function (
    twoLanguage,
    ready,
    Lockr
) {
    const checkNewVersion = function () {
        const currentVersion = '2.0.0'
        const storedVersion = Lockr.get('twoverflow_version', '1.0.0')

        if (currentVersion.endsWith('dev')) {
            return false
        }

        const versionNumber = function (rawVersion) {
            if (/\d+\.\d+\.\d+/.test(rawVersion)) {
                return parseInt(rawVersion.split('.').reduce((a, b) => a + b), 10)
            }
        }

        if (versionNumber(currentVersion) > versionNumber(storedVersion)) {
            const changelogUrl = 'https://gitlab.com/relaxeaza/twoverflow/blob/master/CHANGELOG.md'
            const changelogMsg = $filter('i18n')('check_changes', $rootScope.loc.ale, 'common')
            const firefoxMsg = $filter('i18n')('firefox_shill', $rootScope.loc.ale, 'common')
            const updatedMsg = $filter('i18n')('new_version', $rootScope.loc.ale, 'common', currentVersion)

            $rootScope.$broadcast(eventTypeProvider.NOTIFICATION_NEW, {
                message: `[b]${updatedMsg}[/b]\n[url=${changelogUrl}]${changelogMsg}[/url]\n\n${firefoxMsg}`
            })

            Lockr.set('twoverflow_version', currentVersion)
        }
    }

    ready(function () {
        twoLanguage.init()
        checkNewVersion()
    })
})

/**
 * https://github.com/tsironis/lockr
 */
define('Lockr', function(root, Lockr) {
    'use strict'

    Lockr.prefix = ''

    Lockr._getPrefixedKey = function(key, options) {
        options = options || {}

        if (options.noPrefix) {
            return key
        } else {
            return this.prefix + key
        }

    }

    Lockr.set = function(key, value, options) {
        const query_key = this._getPrefixedKey(key, options)

        try {
            localStorage.setItem(query_key, JSON.stringify({
                data: value
            }))
        } catch (e) {}
    }

    Lockr.get = function(key, missing, options) {
        const query_key = this._getPrefixedKey(key, options)
        let value

        try {
            value = JSON.parse(localStorage.getItem(query_key))
        } catch (e) {
            if (localStorage[query_key]) {
                value = {
                    data: localStorage.getItem(query_key)
                }
            } else {
                value = null
            }
        }
        
        if (value === null) {
            return missing
        } else if (typeof value === 'object' && typeof value.data !== 'undefined') {
            return value.data
        } else {
            return missing
        }
    }

    return Lockr
})

define('two/about', [], function () {
    let initialized = false

    let about = {}

    about.isInitialized = function () {
        return initialized
    }

    about.init = function () {
        initialized = true
    }

    return about
})

define('two/about/ui', [
    'two/ui'
], function (
    interfaceOverflow
) {
    let $scope
    
    const selectTab = function (tabType) {
        $scope.selectedTab = tabType
    }

    const init = function () {
        interfaceOverflow.addDivisor4(189)
        const $button = interfaceOverflow.addMenuButton4('O mnie', 190)

        $button.addEventListener('click', function () {
            buildWindow()
        })

        interfaceOverflow.addTemplate('twoverflow_about_window', `<div id=\"two-about\" class=\"win-content\"><header class=\"win-head\"><h3>tw2overflow v2.0.0</h3><ul class=\"list-btn sprite\"><li><a href=\"#\" class=\"btn-red icon-26x26-close\" ng-click=\"closeWindow()\"></a></ul></header><div class=\"win-main\" scrollbar=\"\"><div class=\"box-paper footer\"><div class=\"scroll-wrap\"><div class=\"logo\"><img src=\"https://i.imgur.com/iNcVMvw.png\"></div><table class=\"tbl-border-light tbl-content tbl-medium-height\"><tr><th colspan=\"2\">{{ 'contact' | i18n:loc.ale:'about' }}<tr><td>{{ 'email' | i18n:loc.ale:'about' }}<td>twoverflow@outlook.com<tr><td colspan=\"2\" class=\"text-center\">If you are willing to pay $, I'm willing to make personal scripts for you.</table><table class=\"tbl-border-light tbl-content tbl-medium-height\"><tr><th colspan=\"2\">{{ 'links' | i18n:loc.ale:'about' }}<tr><td>{{ 'source_code' | i18n:loc.ale:'about' }}<td><a href=\"https://gitlab.com/relaxeaza/twoverflow/\" target=\"_blank\">https://gitlab.com/relaxeaza/twoverflow/</a><tr><td>{{ 'issues_suggestions' | i18n:loc.ale:'about' }}<td><a href=\"https://gitlab.com/relaxeaza/twoverflow/issues\" target=\"_blank\">https://gitlab.com/relaxeaza/twoverflow/issues</a><tr><td>{{ 'translations' | i18n:loc.ale:'about' }}<td><a href=\"https://crowdin.com/project/twoverflow\" target=\"_blank\">https://crowdin.com/project/twoverflow</a></table></div></div></div><footer class=\"win-foot\"><ul class=\"list-btn list-center\"><li><a href=\"#\" class=\"btn-border btn-red\" ng-click=\"closeWindow()\">{{ 'cancel' | i18n:loc.ale:'common' }}</a></ul></footer></div>`)
        interfaceOverflow.addStyle('#two-about{padding:42px 0 0px 0;position:relative;height:100%}#two-about .box-paper a{font-weight:bold;color:#3f2615;text-decoration:none}#two-about .box-paper a:hover{text-shadow:0 1px 0 #000;color:#fff}#two-about .logo{text-align:center;margin-bottom:8px}#two-about table td{padding:0 10px}#two-about table td:first-child{text-align:right;width:20%}')
    }

    const buildWindow = function () {
        $scope = $rootScope.$new()
        $scope.selectTab = selectTab

        windowManagerService.getModal('!twoverflow_about_window', $scope)
    }

    return init
})

require([
    'two/ready',
    'two/about',
    'two/about/ui'
], function (
    ready,
    about,
    aboutInterface
) {
    if (about.isInitialized()) {
        return false
    }

    ready(function () {
        about.init()
        aboutInterface()
    }, ['map'])
})

define('two/alertSender', [
    'queues/EventQueue',
    'two/commandQueue',
    'models/CommandModel',
    'conf/unitTypes'
], function(
    eventQueue,
    commandQueue,
    CommandModel,
    UNIT_TYPES
) { 
    let convert
    var overviewService = injector.get('overviewService')
    var initialized = false
    var running = false
    var globalInfoModel = modelDataService.getSelectedCharacter().getGlobalInfo()
    var COLUMN_TYPES = {
        'ORIGIN_VILLAGE': 'origin_village_name',
        'COMMAND_TYPE': 'command_type',
        'TARGET_VILLAGE': 'target_village_name',
        'TIME_COMPLETED': 'time_completed',
        'COMMAND_PROGRESS': 'command_progress',
        'ORIGIN_CHARACTER': 'origin_character_name'
    }
    var sorting = {
        reverse: false,
        column: COLUMN_TYPES.COMMAND_PROGRESS
    }
    var player = modelDataService.getSelectedCharacter()
    var tribe = player.tribeById
    var tribeId = tribe[0]
    var villages = player.getVillageList()
    var villagesIds = []
    var playerId = player.data.character_id
    var playerName = player.data.character_name
    var attacks = []
    var tribemates = []
    var UNIT_SPEED_ORDER = [
        UNIT_TYPES.LIGHT_CAVALRY,
        UNIT_TYPES.HEAVY_CAVALRY,
        UNIT_TYPES.AXE,
        UNIT_TYPES.SWORD,
        UNIT_TYPES.RAM,
        UNIT_TYPES.SNOB,
        UNIT_TYPES.TREBUCHET
    ]

    function secondsToDaysHHMMSS(totalSeconds) {
        var returnString = ''
        var date = new Date(totalSeconds * 1000)
        convert = date.toLocaleString()
        returnString = convert
        return returnString
    }

    var checkincomingsAttacks = function() {
        socketService.emit(routeProvider.TRIBE_GET_MEMBERLIST, {
            tribe: tribeId
        }, function(data) {
            var members = data.members
            for (var i = 0; i < members.length; i++) {
                tribemates.push(members[i].id)
            }
        })
        villages.forEach(function(village) {
            villagesIds.push(village.getId())
        })
        var incomingCommands = globalInfoModel.getCommandListModel().getIncomingCommands().length
        var count = incomingCommands > 25 ? incomingCommands : 25

        socketService.emit(routeProvider.OVERVIEW_GET_INCOMING, {
            'count': count,
            'offset': 0,
            'sorting': sorting.column,
            'reverse': sorting.reverse ? 1 : 0,
            'groups': [],
            'command_types': ['attack'],
            'villages': villagesIds
        }, sendAlerts)
        setTimeout(checkincomingsAttacks, 60000)
    }

    var sendAlerts = function sendAlerts(data) {
        var alertText = []
        var commands = data.commands
        for (var i = 0; i < commands.length; i++) {
            overviewService.formatCommand(commands[i])
            if (tribemates.includes(commands[i].origin_character_id)) {
                console.log('Nadchodzące ruchy wojsk pochodzą od współplemieńca ' + commands[i].origin_character_id + ' Rodzaj ' + commands[i].command_type)
            } else {
                if (commands[i].command_type == 'attack') {
                    if (attacks.includes(commands[i].command_id)) {
                        console.log('Już wysłano powiadomienie')
                    } else {
                        attacks.push(commands[i].command_id)
                        commands[i].slowestUnit = getSlowestUnit(commands[i])
                        var timecompleted = commands[i].time_completed
                        var finalTime = secondsToDaysHHMMSS(timecompleted)
                        var incomingUnit = ''
                        var incomingName = ''
                        if (commands[i].slowestUnit == 'sword') {
                            incomingName = ' [color=03709d]MIECZNIK[/color]'
                            incomingUnit = 'sword'
                        } else if (commands[i].slowestUnit == 'axe') {
                            incomingName = ' [color=e21f1f]TOPORNIK[/color]'
                            incomingUnit = 'axe'
                        } else if (commands[i].slowestUnit == 'ram') {
                            incomingName = ' [color=730202]TARAN[/color]'
                            incomingUnit = 'ram'
                        } else if (commands[i].slowestUnit == 'snob') {
                            incomingName = ' [color=ffee00]SZLACHCIC[/color]'
                            incomingUnit = 'snob'
                        } else if (commands[i].slowestUnit == 'trebuchet') {
                            incomingName = ' [color=494500]TREBUSZ[/color]'
                            incomingUnit = 'trebuchet'
                        } else if (commands[i].slowestUnit == 'light_cavalry') {
                            incomingName = ' [color=d96a19]LEKKA KAWALERIA[/color]'
                            incomingUnit = 'light_cavalry'
                        } else if (commands[i].slowestUnit == 'heavy_cavalry') {
                            incomingName = ' [color=0111af]CIĘŻKA KAWALERIA[/color]'
                            incomingUnit = 'heavy_cavalry'
                        }
                        alertText.push('[size=large][b]Nadchodzący atak [/b]--- [/size][unit]' + incomingUnit + '[/unit] [size=large][b]' + incomingName + '[/b][/size][br][b][size=XL] Czas dotarcia: ' + finalTime + '[/size][/b][br][size=medium][b] Wioska cel: [/b][village=' + commands[i].target_village_id + ']' + commands[i].target_village_name + '[/village][b] Gracz cel: [/b][player=' + playerId + ']' + playerName + '[/player][b] [br]Wioska pochodzenia: [/b][village=' + commands[i].origin_village_id + ']' + commands[i].origin_village_name + '[/village][b] Gracz atakujący: [/b][player=' + commands[i].origin_character_id + ']' + commands[i].origin_character_name + '[/player][/size]')
                        var message = alertText.join()
                        if (incomingUnit == 'snob' || incomingUnit == 'trebuchet') {
                            if (playerName == 'Hajduk Split' || playerName == 'halfsack' || playerName == 'Black Rider') {
                                socketService.emit(routeProvider.MESSAGE_REPLY, {
                                    message_id: 14378,
                                    message: message
                                })
                            } else {
                                socketService.emit(routeProvider.MESSAGE_REPLY, {
                                    message_id: 4646,
                                    message: message
                                })
                            }
                            alertText = []
                        } else {
                            if (playerName == 'Hajduk Split' || playerName == 'halfsack' || playerName == 'Black Rider') {
                                socketService.emit(routeProvider.MESSAGE_REPLY, {
                                    message_id: 14379,
                                    message: message
                                })
                            } else {
                                socketService.emit(routeProvider.MESSAGE_REPLY, {
                                    message_id: 4648,
                                    message: message
                                })
                            }
                            alertText = []
                        }
                    }
                }
            }
        }
    }

    var getSlowestUnit = function(command) {
        var commandDuration = command.model.duration
        var units = {}
        var origin = {
            x: command.origin_x,
            y: command.origin_y
        }
        var target = {
            x: command.target_x,
            y: command.target_y
        }
        var travelTimes = []

        UNIT_SPEED_ORDER.forEach(function(unit) {
            units[unit] = 1

            travelTimes.push({
                unit: unit,
                duration: commandQueue.getTravelTime(origin, target, units, command.command_type, {})
            })
        })

        travelTimes = travelTimes.map(function(travelTime) {
            travelTime.duration = Math.abs(travelTime.duration - commandDuration)
            return travelTime
        }).sort(function(a, b) {
            return a.duration - b.duration
        })

        return travelTimes[0].unit
    }

    var alertSender = {}
    alertSender.init = function() {
        initialized = true
    }
    alertSender.start = function() {
        eventQueue.trigger(eventTypeProvider.ALERT_SENDER_STARTED)
        running = true
        checkincomingsAttacks()
    }
    alertSender.stop = function() {
        eventQueue.trigger(eventTypeProvider.ALERT_SENDER_STOPPED)
        running = false
    }
    alertSender.isRunning = function() {
        return running
    }
    alertSender.isInitialized = function() {
        return initialized
    }
    return alertSender
})
define('two/alertSender/events', [], function () {
    angular.extend(eventTypeProvider, {
        ALERT_SENDER_STARTED: 'alert_sender_started',
        ALERT_SENDER_STOPPED: 'alert_sender_stopped'
    })
})

define('two/alertSender/ui', [
    'two/ui',
    'two/alertSender',
    'two/utils',
    'queues/EventQueue'
], function (
    interfaceOverflow,
    alertSender,
    utils,
    eventQueue
) {
    let $button

    const init = function () {
        $button = interfaceOverflow.addMenuButton('Wartownik', 60, $filter('i18n')('description', $rootScope.loc.ale, 'alert_sender'))

        $button.addEventListener('click', function () {
            if (alertSender.isRunning()) {
                alertSender.stop()
                utils.notif('success', $filter('i18n')('deactivated', $rootScope.loc.ale, 'alert_sender'))
            } else {
                alertSender.start()
                utils.notif('success', $filter('i18n')('activated', $rootScope.loc.ale, 'alert_sender'))
            }
        })

        eventQueue.register(eventTypeProvider.ALERT_SENDER_STARTED, function () {
            $button.classList.remove('btn-orange')
            $button.classList.add('btn-red')
        })

        eventQueue.register(eventTypeProvider.ALERT_SENDER_STOPPED, function () {
            $button.classList.remove('btn-red')
            $button.classList.add('btn-orange')
        })

        if (alertSender.isRunning()) {
            eventQueue.trigger(eventTypeProvider.ALERT_SENDER_STARTED)
        }

        return opener
    }

    return init
})
require([
    'two/ready',
    'two/alertSender',
    'two/alertSender/ui',
    'Lockr',
    'queues/EventQueue',
    'two/alertSender/events',
], function(
    ready,
    alertSender,
    alertSenderInterface,
    Lockr,
    eventQueue
) {
    const STORAGE_KEYS = {
        ACTIVE: 'alert_sender_active'
    }
	
    if (alertSender.isInitialized()) {
        return false
    }
    ready(function() {
        alertSender.init()
        alertSenderInterface()

        ready(function() {
            if (Lockr.get(STORAGE_KEYS.ACTIVE, false, true)) {
                alertSender.start()
            }

            eventQueue.register(eventTypeProvider.ALERT_SENDER_STARTED, function() {
                Lockr.set(STORAGE_KEYS.ACTIVE, true)
            })

            eventQueue.register(eventTypeProvider.ALERT_SENDER_STOPPED, function() {
                Lockr.set(STORAGE_KEYS.ACTIVE, false)
            })
        }, ['initial_village'])
    })
})
define('two/armyHelper', [
    'two/Settings',
    'two/armyHelper/settings',
    'two/armyHelper/settings/map',
    'two/armyHelper/settings/updates',
    'two/armyHelper/types/unit',
    'two/ready',
    'queues/EventQueue'
], function (
    Settings,
    SETTINGS,
    SETTINGS_MAP,
    UPDATES,
    B_UNIT,
    ready,
    eventQueue
) {
    let initialized = false
    let running = false
    let settings
    let armyHelperSettings

    let selectedGroups1 = []
    let selectedGroups2 = []
    let selectedGroups3 = []
    let selectedGroups4 = []

    const STORAGE_KEYS = {
        SETTINGS: 'army_helper_settings'
    }
	
    const BALANCER_UNIT = {
        [B_UNIT.SPEAR]: 'spear',
        [B_UNIT.SWORD]: 'sword',
        [B_UNIT.AXE]: 'axe',
        [B_UNIT.ARCHER]: 'archer',
        [B_UNIT.LIGHT_CAVALRY]: 'light_cavalry',
        [B_UNIT.MOUNTED_ARCHER]: 'mounted_archer',
        [B_UNIT.HEAVT_CAVALRY]: 'heavy_cavalry',
        [B_UNIT.RAM]: 'ram',
        [B_UNIT.CATAPULT]: 'catapult',
        [B_UNIT.TREBUCHET]: 'trebuchet',
        [B_UNIT.DOPPELSOLDNER]: 'doppelsoldner',
        [B_UNIT.SNOB]: 'snob',
        [B_UNIT.KNIGHT]: 'knight'
    }
    console.log(BALANCER_UNIT)

    const updateGroups = function () {
        selectedGroups1 = []
        selectedGroups2 = []
        selectedGroups3 = []
        selectedGroups4 = []

        const allGroups = modelDataService.getGroupList().getGroups()
        const groupsSelectedByTheUser1 = armyHelperSettings[SETTINGS.GROUP1]
        const groupsSelectedByTheUser2 = armyHelperSettings[SETTINGS.GROUP2]
        const groupsSelectedByTheUser3 = armyHelperSettings[SETTINGS.GROUP3]
        const groupsSelectedByTheUser4 = armyHelperSettings[SETTINGS.GROUP4]

        groupsSelectedByTheUser1.forEach(function (groupId) {
            selectedGroups1.push(allGroups[groupId])
        })
        groupsSelectedByTheUser2.forEach(function (groupId) {
            selectedGroups2.push(allGroups[groupId])
        })
        groupsSelectedByTheUser3.forEach(function (groupId) {
            selectedGroups3.push(allGroups[groupId])
        })
        groupsSelectedByTheUser4.forEach(function (groupId) {
            selectedGroups4.push(allGroups[groupId])
        })

        console.log('selectedGroups', selectedGroups1, selectedGroups2, selectedGroups3, selectedGroups4)
    }

    const armyHelper = {}

    armyHelper.init = function () {
        initialized = true

        settings = new Settings({
            settingsMap: SETTINGS_MAP,
            storageKey: STORAGE_KEYS.SETTINGS
        })

        settings.onChange(function (changes, updates) {
            armyHelperSettings = settings.getAll()

            if (updates[UPDATES.GROUPS]) {
                updateGroups()
            }
        })

        armyHelperSettings = settings.getAll()

        console.log('all settings', armyHelperSettings)

        $rootScope.$on(eventTypeProvider.GROUPS_CREATED, updateGroups)
        $rootScope.$on(eventTypeProvider.GROUPS_DESTROYED, updateGroups)
        $rootScope.$on(eventTypeProvider.GROUPS_UPDATED, updateGroups)
    }

    armyHelper.start = function () {
        running = true

        eventQueue.trigger(eventTypeProvider.ARMY_HELPER_START)
    }

    armyHelper.stop = function () {
        running = false

        eventQueue.trigger(eventTypeProvider.ARMY_HELPER_STOP)
    }

    armyHelper.getSettings = function () {
        return settings
    }

    armyHelper.isInitialized = function () {
        return initialized
    }

    armyHelper.isRunning = function () {
        return running
    }

    return armyHelper
})

define('two/armyHelper/events', [], function () {
    angular.extend(eventTypeProvider, {
        ARMY_HELPER_START: 'army_helper_start',
        ARMY_HELPER_STOP: 'army_helper_stop'
    })
})

define('two/armyHelper/ui', [
    'two/ui',
    'two/armyHelper',
    'two/armyHelper/settings',
    'two/armyHelper/settings/map',
    'two/armyHelper/types/unit',
    'two/Settings',
    'two/EventScope',
    'two/utils'
], function (
    interfaceOverflow,
    armyHelper,
    SETTINGS,
    SETTINGS_MAP,
    B_UNIT,
    Settings,
    EventScope,
    utils
) {
    let $scope
    let settings
    let groupList = modelDataService.getGroupList()
    let $button
    
    const TAB_TYPES = {
        PRESETS: 'presets',
        ARMY: 'army',
        BALANCER: 'balancer'
    }

    const selectTab = function (tabType) {
        $scope.selectedTab = tabType
    }

    const saveSettings = function () {
        settings.setAll(settings.decode($scope.settings))

        utils.notif('success', 'Settings saved')
    }

    const switchState = function () {
        if (armyHelper.isRunning()) {
            armyHelper.stop()
        } else {
            armyHelper.start()
        }
    }

    const eventHandlers = {
        updateGroups: function () {
            $scope.groups = Settings.encodeList(groupList.getGroups(), {
                disabled: false,
                type: 'groups'
            })
        },
        start: function () {
            $scope.running = true

            $button.classList.remove('btn-orange')
            $button.classList.add('btn-red')

            utils.notif('success', $filter('i18n')('general.stopped', $rootScope.loc.ale, 'army_helper'))
        },
        stop: function () {
            $scope.running = false

            $button.classList.remove('btn-red')
            $button.classList.add('btn-orange')

            utils.notif('success', $filter('i18n')('general.stopped', $rootScope.loc.ale, 'army_helper'))
        }
    }

    const init = function () {
        settings = armyHelper.getSettings()
        $button = interfaceOverflow.addMenuButton('Administrator', 90)
        $button.addEventListener('click', buildWindow)

        interfaceOverflow.addTemplate('twoverflow_army_helper_window', `<div id=\"two-army-helper\" class=\"win-content two-window\"><header class=\"win-head\"><h2>Administrator</h2><ul class=\"list-btn\"><li><a href=\"#\" class=\"size-34x34 btn-red icon-26x26-close\" ng-click=\"closeWindow()\"></a></ul></header><div class=\"win-main\" scrollbar=\"\"><div class=\"tabs tabs-bg\"><div class=\"tabs-three-col\"><div class=\"tab\" ng-click=\"selectTab(TAB_TYPES.PRESETS)\" ng-class=\"{'tab-active': selectedTab == TAB_TYPES.PRESETS}\"><div class=\"tab-inner\"><div ng-class=\"{'box-border-light': selectedTab === TAB_TYPES.PRESETS}\"><a href=\"#\" ng-class=\"{'btn-icon btn-orange': selectedTab !== TAB_TYPES.PRESETS}\">{{ TAB_TYPES.PRESETS | i18n:loc.ale:'army_helper' }}</a></div></div></div><div class=\"tab\" ng-click=\"selectTab(TAB_TYPES.ARMY)\" ng-class=\"{'tab-active': selectedTab == TAB_TYPES.ARMY}\"><div class=\"tab-inner\"><div ng-class=\"{'box-border-light': selectedTab === TAB_TYPES.ARMY}\"><a href=\"#\" ng-class=\"{'btn-icon btn-orange': selectedTab !== TAB_TYPES.ARMY}\">{{ TAB_TYPES.ARMY | i18n:loc.ale:'army_helper' }}</a></div></div></div><div class=\"tab\" ng-click=\"selectTab(TAB_TYPES.BALANCER)\" ng-class=\"{'tab-active': selectedTab == TAB_TYPES.BALANCER}\"><div class=\"tab-inner\"><div ng-class=\"{'box-border-light': selectedTab === TAB_TYPES.BALANCER}\"><a href=\"#\" ng-class=\"{'btn-icon btn-orange': selectedTab !== TAB_TYPES.BALANCER}\">{{ TAB_TYPES.BALANCER | i18n:loc.ale:'army_helper' }}</a></div></div></div></div></div><div class=\"box-paper footer\"><div class=\"scroll-wrap\"><div class=\"settings\" ng-show=\"selectedTab === TAB_TYPES.PRESETS\"><h5 class=\"twx-section\">{{ 'presets-all' | i18n:loc.ale:'army_helper' }}</h5><form class=\"addForm\"><table class=\"tbl-border-light tbl-striped\"><col><col width=\"18%\"><tr><td class=\"item-name\">{{ 'presets.all' | i18n:loc.ale:'army_helper' }}<td class=\"item-asignAll\"><span class=\"btn btn-orange addSelected\" tooltip=\"\" tooltip-content=\"{{ 'asigningAll' | i18n:loc.ale:'army_helper' }}\">{{ 'asign' | i18n:loc.ale:'army_helper' }}</span></table></form><h5 class=\"twx-section\">{{ 'presets-name' | i18n:loc.ale:'army_helper' }}</h5><form class=\"addForm\"><table class=\"tbl-border-light tbl-striped\"><col width=\"20%\"><col><col width=\"18%\"><tr><td class=\"cell-bottom\"><input class=\"fit textfield-border text-center\" ng-model=\"settings[SETTINGS.PRESET_NAME1]\"><td class=\"item-name\">{{ 'presets.name' | i18n:loc.ale:'army_helper' }}<td class=\"item-asignName\"><span class=\"btn btn-orange addSelected\" tooltip=\"\" tooltip-content=\"{{ 'asigningName' | i18n:loc.ale:'army_helper' }}\">{{ 'asign' | i18n:loc.ale:'army_helper' }}</span></table></form><h5 class=\"twx-section\">{{ 'presets-group' | i18n:loc.ale:'army_helper' }}</h5><form class=\"addForm\"><table class=\"tbl-border-light tbl-striped\"><col width=\"20%\"><col><col width=\"18%\"><tr><td><div select=\"\" list=\"groups\" selected=\"settings[SETTINGS.GROUP1]\" drop-down=\"true\"></div><td class=\"item-name\">{{ 'presets.group' | i18n:loc.ale:'army_helper' }}<td class=\"item-asignGroup\"><span class=\"btn btn-orange addSelected\" tooltip=\"\" tooltip-content=\"{{ 'asigningGroup' | i18n:loc.ale:'army_helper' }}\">{{ 'asign' | i18n:loc.ale:'army_helper' }}</span></table></form><h5 class=\"twx-section\">{{ 'presets-ng' | i18n:loc.ale:'army_helper' }}</h5><form class=\"addForm\"><table class=\"tbl-border-light tbl-striped\"><col width=\"20%\"><col width=\"20%\"><col><col width=\"18%\"><tr><td class=\"cell-bottom\"><input class=\"fit textfield-border text-center\" ng-model=\"settings[SETTINGS.PRESET_NAME2]\"><td><div select=\"\" list=\"groups\" selected=\"settings[SETTINGS.GROUP2]\" drop-down=\"true\"></div><td class=\"item-name\">{{ 'presets.ng' | i18n:loc.ale:'army_helper' }}<td class=\"item-asignNG\"><span class=\"btn btn-orange addSelected\" tooltip=\"\" tooltip-content=\"{{ 'asigningNG' | i18n:loc.ale:'army_helper' }}\">{{ 'asign' | i18n:loc.ale:'army_helper' }}</span></table></form></div><div class=\"settings\" ng-show=\"selectedTab === TAB_TYPES.ARMY\"><h5 class=\"twx-section\">{{ 'check' | i18n:loc.ale:'army_helper' }}</h5><form class=\"addForm\"><table class=\"tbl-border-light tbl-striped\"><col><tr><td class=\"item-check\"><span class=\"btn btn-orange addSelected\" tooltip=\"\" tooltip-content=\"{{ 'check.tip' | i18n:loc.ale:'army_helper' }}\">{{ 'check.btn' | i18n:loc.ale:'army_helper' }}</span></table></form><h5 class=\"twx-section\">{{ 'army.amounts' | i18n:loc.ale:'army_helper' }}</h5><form class=\"addForm1\"><table class=\"tbl-border-light tbl-striped\"><col><col width=\"12%\"><col width=\"12%\"><col width=\"12%\"><col width=\"12%\"><col width=\"12%\"><col width=\"12%\"><tr><th class=\"item-head\">{{ 'unit' | i18n:loc.ale:'army_helper' }}<th class=\"item-head\">{{ 'available' | i18n:loc.ale:'army_helper' }}<th class=\"item-head\">{{ 'own' | i18n:loc.ale:'army_helper' }}<th class=\"item-head\">{{ 'in-town' | i18n:loc.ale:'army_helper' }}<th class=\"item-head\">{{ 'support' | i18n:loc.ale:'army_helper' }}<th class=\"item-head\">{{ 'recruiting' | i18n:loc.ale:'army_helper' }}<th class=\"item-head\">{{ 'total' | i18n:loc.ale:'army_helper' }}<tr><td class=\"item-nameX\" colspan=\"7\">{{ 'deffensive-troops' | i18n:loc.ale:'army_helper' }}<tr><td class=\"item-name\"><span class=\"icon-bg-black icon-34x34-unit-spear\"></span> {{ 'spear' | i18n:loc.ale:'common' }}<td class=\"item-spear-a\"><td class=\"item-spear-o\"><td class=\"item-spear-i\"><td class=\"item-spear-s\"><td class=\"item-spear-r\"><td class=\"item-spear-t\"><tr><td class=\"item-name\"><span class=\"icon-bg-black icon-34x34-unit-sword\"></span> {{ 'sword' | i18n:loc.ale:'common' }}<td class=\"item-sword-a\"><td class=\"item-sword-o\"><td class=\"item-sword-i\"><td class=\"item-sword-s\"><td class=\"item-sword-r\"><td class=\"item-sword-t\"><tr><td class=\"item-name\"><span class=\"icon-bg-black icon-34x34-unit-archer\"></span> {{ 'archer' | i18n:loc.ale:'common' }}<td class=\"item-archer-a\"><td class=\"item-archer-o\"><td class=\"item-archer-i\"><td class=\"item-archer-s\"><td class=\"item-archer-r\"><td class=\"item-archer-t\"><tr><td class=\"item-name\"><span class=\"icon-bg-black icon-34x34-unit-heavy_cavalry\"></span> {{ 'heavy_cavalry' | i18n:loc.ale:'common' }}<td class=\"item-hc-a\"><td class=\"item-hc-o\"><td class=\"item-hc-i\"><td class=\"item-hc-s\"><td class=\"item-hc-r\"><td class=\"item-hc-t\"><tr><td class=\"item-name\"><span class=\"icon-bg-black icon-34x34-unit-trebuchet\"></span> {{ 'trebuchet' | i18n:loc.ale:'common' }}<td class=\"item-trebuchet-a\"><td class=\"item-trebuchet-o\"><td class=\"item-trebuchet-i\"><td class=\"item-trebuchet-s\"><td class=\"item-trebuchet-r\"><td class=\"item-trebuchet-t\"><tr><td class=\"item-nameX\" colspan=\"7\">{{ 'offensive-troops' | i18n:loc.ale:'army_helper' }}<tr><td class=\"item-name\"><span class=\"icon-bg-black icon-34x34-unit-axe\"></span> {{ 'axe' | i18n:loc.ale:'common' }}<td class=\"item-axe-a\"><td class=\"item-axe-o\"><td class=\"item-axe-i\"><td class=\"item-axe-s\"><td class=\"item-axe-r\"><td class=\"item-axe-t\"><tr><td class=\"item-name\"><span class=\"icon-bg-black icon-34x34-unit-light_cavalry\"></span> {{ 'light_cavalry' | i18n:loc.ale:'common' }}<td class=\"item-lc-a\"><td class=\"item-lc-o\"><td class=\"item-lc-i\"><td class=\"item-lc-s\"><td class=\"item-lc-r\"><td class=\"item-lc-t\"><tr><td class=\"item-name\"><span class=\"icon-bg-black icon-34x34-unit-mounted_archer\"></span> {{ 'mounted_archer' | i18n:loc.ale:'common' }}<td class=\"item-ma-a\"><td class=\"item-ma-o\"><td class=\"item-ma-i\"><td class=\"item-ma-s\"><td class=\"item-ma-r\"><td class=\"item-ma-t\"><tr><td class=\"item-name\"><span class=\"icon-bg-black icon-34x34-unit-ram\"></span> {{ 'ram' | i18n:loc.ale:'common' }}<td class=\"item-ram-a\"><td class=\"item-ram-o\"><td class=\"item-ram-i\"><td class=\"item-ram-s\"><td class=\"item-ram-r\"><td class=\"item-ram-t\"><tr><td class=\"item-name\"><span class=\"icon-bg-black icon-34x34-unit-catapult\"></span> {{ 'catapult' | i18n:loc.ale:'common' }}<td class=\"item-catapult-a\"><td class=\"item-catapult-o\"><td class=\"item-catapult-i\"><td class=\"item-catapult-s\"><td class=\"item-catapult-r\"><td class=\"item-catapult-t\"><tr><td class=\"item-name\"><span class=\"icon-bg-black icon-34x34-unit-doppelsoldner\"></span> {{ 'doppelsoldner' | i18n:loc.ale:'common' }}<td class=\"item-berserker-a\"><td class=\"item-berserker-o\"><td class=\"item-berserker-i\"><td class=\"item-berserker-s\"><td class=\"item-berserker-r\"><td class=\"item-berserker-t\"><tr><td class=\"item-nameX\" colspan=\"7\">{{ 'special-troops' | i18n:loc.ale:'army_helper' }}<tr><td class=\"item-name\"><span class=\"icon-bg-black icon-34x34-unit-snob\"></span> {{ 'snob' | i18n:loc.ale:'common' }}<td class=\"item-snob-a\"><td class=\"item-snob-o\"><td class=\"item-snob-i\"><td class=\"item-snob-s\"><td class=\"item-snob-r\"><td class=\"item-snob-t\"><tr><td class=\"item-name\"><span class=\"icon-bg-black icon-34x34-unit-knight\"></span> {{ 'knight' | i18n:loc.ale:'common' }}<td class=\"item-knight-a\"><td class=\"item-knight-o\"><td class=\"item-knight-i\"><td class=\"item-knight-s\"><td class=\"item-knight-r\"><td class=\"item-knight-t\"></table></form></div><div class=\"settings\" ng-show=\"selectedTab === TAB_TYPES.BALANCER\"><h5 class=\"twx-section\">{{ 'balance-all' | i18n:loc.ale:'army_helper' }}</h5><form class=\"addForm\"><table class=\"tbl-border-light tbl-striped\"><col><col width=\"18%\"><tr><td class=\"item-name\">{{ 'balance.all' | i18n:loc.ale:'army_helper' }}<td class=\"item-balanceAll\"><span class=\"btn btn-orange addSelected\" tooltip=\"\" tooltip-content=\"{{ 'balancingAll' | i18n:loc.ale:'army_helper' }}\">{{ 'balance' | i18n:loc.ale:'army_helper' }}</span></table></form><h5 class=\"twx-section\">{{ 'balance-unit' | i18n:loc.ale:'army_helper' }}</h5><form class=\"addForm\"><table class=\"tbl-border-light tbl-striped\"><col width=\"25%\"><col><col width=\"18%\"><tr><td><div select=\"\" list=\"unit\" selected=\"settings[SETTINGS.UNIT_TYPE1]\" drop-down=\"true\"></div><td class=\"item-name\">{{ 'balance.unit' | i18n:loc.ale:'army_helper' }}<td class=\"item-balanceUnit\"><span class=\"btn btn-orange addSelected\" tooltip=\"\" tooltip-content=\"{{ 'balancingUnit' | i18n:loc.ale:'army_helper' }}\">{{ 'balance' | i18n:loc.ale:'army_helper' }}</span></table></form><h5 class=\"twx-section\">{{ 'balance-group' | i18n:loc.ale:'army_helper' }}</h5><form class=\"addForm\"><table class=\"tbl-border-light tbl-striped\"><col width=\"20%\"><col><col width=\"18%\"><tr><td><div select=\"\" list=\"groups\" selected=\"settings[SETTINGS.GROUP3]\" drop-down=\"true\"></div><td class=\"item-name\">{{ 'balance.group' | i18n:loc.ale:'army_helper' }}<td class=\"item-balanceGroup\"><span class=\"btn btn-orange addSelected\" tooltip=\"\" tooltip-content=\"{{ 'balancingGroup' | i18n:loc.ale:'army_helper' }}\">{{ 'balance' | i18n:loc.ale:'army_helper' }}</span></table></form><h5 class=\"twx-section\">{{ 'balance-ug' | i18n:loc.ale:'army_helper' }}</h5><form class=\"addForm\"><table class=\"tbl-border-light tbl-striped\"><col width=\"20%\"><col width=\"20%\"><col><col width=\"18%\"><tr><td><div select=\"\" list=\"unit\" selected=\"settings[SETTINGS.UNIT_TYPE2]\" drop-down=\"true\"></div><td><div select=\"\" list=\"groups\" selected=\"settings[SETTINGS.GROUP4]\" drop-down=\"true\"></div><td class=\"item-name\">{{ 'balance.ug' | i18n:loc.ale:'army_helper' }}<td class=\"item-balanceUG\"><span class=\"btn btn-orange addSelected\" tooltip=\"\" tooltip-content=\"{{ 'balancingUG' | i18n:loc.ale:'army_helper' }}\">{{ 'balance' | i18n:loc.ale:'army_helper' }}</span></table></form></div></div></div></div><footer class=\"win-foot\"><ul class=\"list-btn list-center\"></ul></footer></div>`)
        interfaceOverflow.addStyle('#two-army-helper div[select]{float:right}#two-army-helper div[select] .select-handler{line-height:28px}#two-army-helper .range-container{width:250px}#two-army-helper .textfield-border{width:219px;height:34px;margin-bottom:2px;padding-top:2px}#two-army-helper .textfield-border.fit{width:100%}#two-army-helper .addForm1 input{width:100%}#two-army-helper .addForm1 td{text-align:center;height:34px;line-height:34px}#two-army-helper .addForm1 th{text-align:center;padding:0px}#two-army-helper .addForm1 span{height:34px;line-height:34px;padding:0 10px}#two-army-helper .addForm1 .item-name{text-align:left}#two-army-helper .addForm input{width:100%}#two-army-helper .addForm td{text-align:center}#two-army-helper .addForm th{text-align:center;padding:0px}#two-army-helper .addForm span{height:26px;line-height:26px;padding:0 10px}')
    }

    const buildWindow = function () {
        $scope = $rootScope.$new()
        $scope.SETTINGS = SETTINGS
        $scope.TAB_TYPES = TAB_TYPES
        $scope.running = armyHelper.isRunning()
        $scope.selectedTab = TAB_TYPES.PRESETS
        $scope.settingsMap = SETTINGS_MAP
        $scope.unit = Settings.encodeList(B_UNIT, {
            textObject: 'army_helper',
            disabled: true
        })

        settings.injectScope($scope)
        eventHandlers.updateGroups()

        $scope.selectTab = selectTab
        $scope.saveSettings = saveSettings
        $scope.switchState = switchState

        let eventScope = new EventScope('twoverflow_army_helper_window', function onDestroy () {
            console.log('armyHelper window closed')
        })
        eventScope.register(eventTypeProvider.GROUPS_CREATED, eventHandlers.updateGroups, true)
        eventScope.register(eventTypeProvider.GROUPS_DESTROYED, eventHandlers.updateGroups, true)
        eventScope.register(eventTypeProvider.GROUPS_UPDATED, eventHandlers.updateGroups, true)
        eventScope.register(eventTypeProvider.ARMY_HELPER_START, eventHandlers.start)
        eventScope.register(eventTypeProvider.ARMY_HELPER_STOP, eventHandlers.stop)
        
        windowManagerService.getScreenWithInjectedScope('!twoverflow_army_helper_window', $scope)
    }

    return init
})

define('two/armyHelper/settings', [], function () {
    return {
        PRESET_NAME1: 'preset1',
        PRESET_NAME2: 'preset2',
        GROUP1: 'group1',
        GROUP2: 'group2',
        GROUP3: 'group3',
        GROUP4: 'group4',
        UNIT_TYPE1: 'unit_type1',
        UNIT_TYPE2: 'unit_type2'
    }
})

define('two/armyHelper/settings/updates', function () {
    return {
        GROUPS: 'groups'
    }
})

define('two/armyHelper/settings/map', [
    'two/armyHelper/settings',
    'two/armyHelper/settings/updates'
], function (
    SETTINGS,
    UPDATES
) {
    return {
        [SETTINGS.GROUP1]: {
            default: [],
            updates: [
                UPDATES.GROUPS,
            ],
            disabledOption: true,
            inputType: 'select',
            multiSelect: false,
            type: 'groups'
        },
        [SETTINGS.GROUP2]: {
            default: [],
            updates: [
                UPDATES.GROUPS,
            ],
            disabledOption: true,
            inputType: 'select',
            multiSelect: false,
            type: 'groups'
        },
        [SETTINGS.GROUP3]: {
            default: [],
            updates: [
                UPDATES.GROUPS,
            ],
            disabledOption: true,
            inputType: 'select',
            multiSelect: false,
            type: 'groups'
        },
        [SETTINGS.GROUP4]: {
            default: [],
            updates: [
                UPDATES.GROUPS,
            ],
            disabledOption: true,
            inputType: 'select',
            multiSelect: false,
            type: 'groups'
        },
        [SETTINGS.UNIT_TYPE1]: {
            default: false,
            disabledOption: true,
            inputType: 'select'
        },
        [SETTINGS.UNIT_TYPE2]: {
            default: false,
            disabledOption: true,
            inputType: 'select'
        }
    }
})

define('two/armyHelper/types/unit', [], function () {
    return {
        SPEAR: 'spear',
        SWORD: 'sword',
        AXE: 'axe',
        ARCHER: 'archer',
        LIGHT_CAVALRY: 'light_cavalry',
        MOUNTED_ARCHER: 'mounted_archer',
        HEAVY_CAVALRY: 'heavy_cavalry',
        RAM: 'ram',
        CATAPULT: 'catapult',
        TREBUCHET: 'trebuchet',
        DOPPELSOLDNER: 'doppelsoldner',
        SNOB: 'snob',
        KNIGHT: 'knight'
    }
})
require([
    'two/ready',
    'two/armyHelper',
    'two/armyHelper/ui',
    'two/armyHelper/events'
], function (
    ready,
    armyHelper,
    armyHelperInterface
) {
    if (armyHelper.isInitialized()) {
        return false
    }

    ready(function () {
        armyHelper.init()
        armyHelperInterface()
    }, ['map', 'world_config'])
})

define('two/attackView', [
    'two/ready',
    'two/utils',
    'two/attackView/types/columns',
    'two/attackView/types/commands',
    'two/attackView/types/filters',
    'two/attackView/unitSpeedOrder',
    'conf/unitTypes',
    'conf/buildingTypes',
    'Lockr',
    'helper/math',
    'helper/mapconvert',
    'struct/MapData',
    'queues/EventQueue'
], function (
    ready,
    utils,
    COLUMN_TYPES,
    COMMAND_TYPES,
    FILTER_TYPES,
    UNIT_SPEED_ORDER,
    UNIT_TYPES,
    BUILDING_TYPES,
    Lockr,
    math,
    convert,
    mapData,
    eventQueue
) {
    let initialized = false
    let overviewService = injector.get('overviewService')
    let globalInfoModel
    let commands = []
    let commandQueue = false
    let filters = {}
    let filterParams = {}
    let sorting = {
        reverse: false,
        column: COLUMN_TYPES.TIME_COMPLETED
    }
    let COMMAND_QUEUE_DATE_TYPES
    const STORAGE_KEYS = {
        FILTERS: 'attack_view_filters'
    }
    const INCOMING_UNITS_FILTER = {}
    const COMMAND_TYPES_FILTER = {}

    const formatFilters = function () {
        const toArray = [FILTER_TYPES.COMMAND_TYPES]
        const currentVillageId = modelDataService.getSelectedVillage().getId()
        let arrays = {}

        // format filters for backend
        for (let i = 0; i < toArray.length; i++) {
            for (let j in filters[toArray[i]]) {
                if (!arrays[toArray[i]]) {
                    arrays[toArray[i]] = []
                }

                if (filters[toArray[i]][j]) {
                    switch (toArray[i]) {
                        case FILTER_TYPES.COMMAND_TYPES: {
                            if (j === COMMAND_TYPES.ATTACK) {
                                arrays[toArray[i]].push(COMMAND_TYPES.ATTACK)
                            } else if (j === COMMAND_TYPES.SUPPORT) {
                                arrays[toArray[i]].push(COMMAND_TYPES.SUPPORT)
                            } else if (j === COMMAND_TYPES.RELOCATE) {
                                arrays[toArray[i]].push(COMMAND_TYPES.RELOCATE)
                            }
                            break
                        }
                    }
                }
            }
        }

        filterParams = arrays
        filterParams.village = filters[FILTER_TYPES.VILLAGE] ? [currentVillageId] : []
    }

    /**
     * Command was sent.
     */
    const onCommandIncomming = function () {
        // we can never know if the command is currently visible (because of filters, sorting and stuff) -> reload
        attackView.loadCommands()
    }

    /**
     * Command was cancelled.
     *
     * @param {Object} event unused
     * @param {Object} data The backend-data
     */
    const onCommandCancelled = function (event, data) {
        eventQueue.trigger(eventTypeProvider.ATTACK_VIEW_COMMAND_CANCELLED, [data.id || data.command_id])
    }

    /**
     * Command ignored.
     *
     * @param {Object} event unused
     * @param {Object} data The backend-data
     */
    const onCommandIgnored = function (event, data) {
        for (let i = 0; i < commands.length; i++) {
            if (commands[i].command_id === data.command_id) {
                commands.splice(i, 1)
            }
        }

        eventQueue.trigger(eventTypeProvider.ATTACK_VIEW_COMMAND_IGNORED, [data.command_id])
    }

    /**
     * Village name changed.
     *
     * @param {Object} event unused
     * @param {Object} data The backend-data
     */
    const onVillageNameChanged = function (event, data) {
        for (let i = 0; i < commands.length; i++) {
            if (commands[i].target_village_id === data.village_id) {
                commands[i].target_village_name = data.name
                commands[i].targetVillage.name = data.name
            } else if (commands[i].origin_village_id === data.village_id) {
                commands[i].origin_village_name = data.name
                commands[i].originVillage.name = data.name
            }
        }

        eventQueue.trigger(eventTypeProvider.ATTACK_VIEW_VILLAGE_RENAMED, [data])
    }

    const onVillageSwitched = function (e, newVillageId) {
        if (filterParams[FILTER_TYPES.VILLAGE].length) {
            filterParams[FILTER_TYPES.VILLAGE] = [newVillageId]

            attackView.loadCommands()
        }
    }

    /**
     * @param {CommandModel} command
     * @return {String} Slowest unit
     */
    const getSlowestUnit = function (command) {
        const origin = {
            x: command.origin_x,
            y: command.origin_y
        }
        const target = {
            x: command.target_x,
            y: command.target_y
        }
        const unitDurationDiff = UNIT_SPEED_ORDER.map(function (unit) {
            const travelTime = utils.getTravelTime(origin, target, {[unit]: 1}, command.command_type, {}, false)
            const durationDiff = Math.abs(travelTime - command.model.duration)

            return {
                unit: unit,
                diff: durationDiff
            }
        }).sort(function (a, b) {
            return a.diff - b.diff
        })

        return unitDurationDiff[0].unit
    }

    /**
     * Sort a set of villages by distance from a specified village.
     *
     * @param {Array[{x: Number, y: Number}]} villages List of village that will be sorted.
     * @param {VillageModel} origin
     * @return {Array} Sorted villages
     */
    const sortByDistance = function (villages, origin) {
        return villages.sort(function (villageA, villageB) {
            let distA = math.actualDistance(origin, villageA)
            let distB = math.actualDistance(origin, villageB)

            return distA - distB
        })
    }

    /**
     * Order:
     * - Barbarian villages.
     * - Own villages.
     * - Tribe villages.
     *
     * @param {VillageModel} origin
     * @param {Function} callback
     */
    const closestNonHostileVillage = function (origin, callback) {
        const size = 25
        let loadBlockIndex = 0

        if (mapData.hasTownDataInChunk(origin.x, origin.y)) {
            const sectors = mapData.loadTownData(origin.x, origin.y, size, size, size)
            const tribeId = modelDataService.getSelectedCharacter().getTribeId()
            const playerId = modelDataService.getSelectedCharacter().getId()
            let targets = []
            let closestTargets

            sectors.forEach(function (sector) {
                for (let x in sector.data) {
                    for (let y in sector.data[x]) {
                        targets.push(sector.data[x][y])
                    }
                }
            })


            const barbs = targets.filter(function (target) {
                return target.character_id === null && target.id > 0
            })

            const own = targets.filter(function (target) {
                return target.character_id === playerId && origin.id !== target.id
            })

            if (barbs.length) {
                closestTargets = sortByDistance(barbs, origin)
            } else if (own.length) {
                closestTargets = sortByDistance(own, origin)
            } else if (tribeId) {
                const tribe = targets.filter(function (target) {
                    return target.tribe_id === tribeId
                })

                if (tribe.length) {
                    closestTargets = sortByDistance(tribe, origin)
                } else {
                    return callback(false)
                }
            } else {
                return callback(false)
            }

            return callback(closestTargets[0])
        }
        
        const loads = convert.scaledGridCoordinates(origin.x, origin.y, size, size, size)

        mapData.loadTownDataAsync(origin.x, origin.y, size, size, function () {
            if (++loadBlockIndex === loads.length) {
                closestNonHostileVillage(origin, callback)
            }
        })
    }

    /**
     * @param {Object} data The data-object from the backend
     */
    const onOverviewIncomming = function (data) {
        commands = data.commands

        for (let i = 0; i < commands.length; i++) {
            overviewService.formatCommand(commands[i])
            commands[i].slowestUnit = getSlowestUnit(commands[i])
        }

        commands = commands.filter(function (command) {
            return filters[FILTER_TYPES.INCOMING_UNITS][command.slowestUnit]
        })

        eventQueue.trigger(eventTypeProvider.ATTACK_VIEW_COMMANDS_LOADED, [commands])
    }

    let attackView = {}

    attackView.loadCommands = function () { 
        const incomingCommands = globalInfoModel.getCommandListModel().getIncomingCommands().length
        const count = incomingCommands > 25 ? incomingCommands : 25

        socketService.emit(routeProvider.OVERVIEW_GET_INCOMING, {
            'count': count,
            'offset': 0,
            'sorting': sorting.column,
            'reverse': sorting.reverse ? 1 : 0,
            'groups': [],
            'command_types': filterParams[FILTER_TYPES.COMMAND_TYPES],
            'villages': filterParams[FILTER_TYPES.VILLAGE]
        }, onOverviewIncomming)
    }

    attackView.getCommands = function () {
        return commands
    }

    attackView.getFilters = function () {
        return filters
    }

    attackView.getSortings = function () {
        return sorting
    }

    /**
     * Toggles the given filter.
     *
     * @param {string} type The category of the filter (see FILTER_TYPES)
     * @param {string} opt_filter The filter to be toggled.
     */
    attackView.toggleFilter = function (type, opt_filter) {
        if (!opt_filter) {
            filters[type] = !filters[type]
        } else {
            filters[type][opt_filter] = !filters[type][opt_filter]
        }

        // format filters for the backend
        formatFilters()
        Lockr.set(STORAGE_KEYS.FILTERS, filters)
        attackView.loadCommands()
    }

    attackView.toggleSorting = function (newColumn) {
        if (newColumn === sorting.column) {
            sorting.reverse = !sorting.reverse
        } else {
            sorting.column = newColumn
            sorting.reverse = false
        }

        attackView.loadCommands()
    }

    /**
     * Set an automatic command with all units from the village
     * and start the CommandQueue module if it's disabled.
     *
     * @param {Object} command Data of the command like origin, target.
     * @param {String} date Date that the command has to leave.
     */
    attackView.setCommander = function (command, date) {
        closestNonHostileVillage(command.targetVillage, function (closestVillage) {
            const origin = command.targetVillage
            const target = closestVillage
            const commandType = target.character_id ? COMMAND_TYPES.SUPPORT : COMMAND_TYPES.ATTACK
            let units = {}

            utils.each(UNIT_TYPES, function (unit) {
                units[unit] = '*'
            })

            commandQueue.addCommand(origin, target, date, COMMAND_QUEUE_DATE_TYPES.OUT, units, {}, commandType , BUILDING_TYPES.WALL)

            if (!commandQueue.isRunning()) {
                commandQueue.start()
            }
        })
    }

    attackView.commandQueueEnabled = function () {
        return !!commandQueue
    }

    attackView.isInitialized = function () {
        return initialized
    }

    attackView.init = function () {
        for (let i = 0; i < UNIT_SPEED_ORDER.length; i++) {
            INCOMING_UNITS_FILTER[UNIT_SPEED_ORDER[i]] = true
        }

        for (let i in COMMAND_TYPES) {
            COMMAND_TYPES_FILTER[COMMAND_TYPES[i]] = true
        }

        try {
            commandQueue = require('two/commandQueue')
            COMMAND_QUEUE_DATE_TYPES = require('two/commandQueue/types/dates')
        } catch (e) {}

        const defaultFilters = {
            [FILTER_TYPES.COMMAND_TYPES]: angular.copy(COMMAND_TYPES_FILTER),
            [FILTER_TYPES.INCOMING_UNITS]: angular.copy(INCOMING_UNITS_FILTER),
            [FILTER_TYPES.VILLAGE]: false
        }

        initialized = true
        globalInfoModel = modelDataService.getSelectedCharacter().getGlobalInfo()
        filters = Lockr.get(STORAGE_KEYS.FILTERS, defaultFilters, true)

        ready(function () {
            formatFilters()

            $rootScope.$on(eventTypeProvider.COMMAND_INCOMING, onCommandIncomming)
            $rootScope.$on(eventTypeProvider.COMMAND_CANCELLED, onCommandCancelled)
            $rootScope.$on(eventTypeProvider.MAP_SELECTED_VILLAGE, onVillageSwitched)
            $rootScope.$on(eventTypeProvider.VILLAGE_NAME_CHANGED, onVillageNameChanged)
            $rootScope.$on(eventTypeProvider.COMMAND_IGNORED, onCommandIgnored)

            attackView.loadCommands()
        }, ['initial_village'])
    }

    return attackView
})

define('two/attackView/events', [], function () {
    angular.extend(eventTypeProvider, {
        ATTACK_VIEW_FILTERS_CHANGED: 'attack_view_filters_changed',
        ATTACK_VIEW_SORTING_CHANGED: 'attack_view_sorting_changed',
        ATTACK_VIEW_COMMAND_CANCELLED: 'attack_view_command_cancelled',
        ATTACK_VIEW_COMMAND_IGNORED: 'attack_view_command_ignored',
        ATTACK_VIEW_VILLAGE_RENAMED: 'attack_view_village_renamed',
        ATTACK_VIEW_COMMANDS_LOADED: 'attack_view_commands_loaded'
    })
})

define('two/attackView/ui', [
    'two/ui',
    'two/attackView',
    'two/EventScope',
    'two/utils',
    'two/attackView/types/columns',
    'two/attackView/types/commands',
    'two/attackView/types/filters',
    'two/attackView/unitSpeedOrder',
    'conf/unitTypes',
    'queues/EventQueue',
    'helper/time',
    'battlecat'
], function (
    interfaceOverflow,
    attackView,
    EventScope,
    utils,
    COLUMN_TYPES,
    COMMAND_TYPES,
    FILTER_TYPES,
    UNIT_SPEED_ORDER,
    UNIT_TYPES,
    eventQueue,
    timeHelper,
    $
) {
    let $scope
    let $button

    const nowSeconds = function () {
        return Date.now() / 1000
    }

    const copyTimeModal = function (time) {
        let modalScope = $rootScope.$new()
        modalScope.text = $filter('readableDateFilter')(time * 1000, $rootScope.loc.ale, $rootScope.GAME_TIMEZONE, $rootScope.GAME_TIME_OFFSET, 'H:mm:ss:sss dd/MM/yyyy')
        modalScope.title = $filter('i18n')('copy', $rootScope.loc.ale, 'attack_view')
        windowManagerService.getModal('!twoverflow_attack_view_show_text_modal', modalScope)
    }

    const removeTroops = function (command) {
        const formatedDate = $filter('readableDateFilter')((command.time_completed - 10) * 1000, $rootScope.loc.ale, $rootScope.GAME_TIMEZONE, $rootScope.GAME_TIME_OFFSET, 'H:mm:ss:sss dd/MM/yyyy')
        console.log(formatedDate)
        attackView.setCommander(command, formatedDate)
    }

    const switchWindowSize = function () {
        let $window = $('#two-attack-view').parent()
        let $wrapper = $('#wrapper')

        $window.toggleClass('fullsize')
        $wrapper.toggleClass('window-fullsize')
    }

    const updateVisibileCommands = function () {
        const offset = $scope.pagination.offset
        const limit = $scope.pagination.limit

        $scope.visibleCommands = $scope.commands.slice(offset, offset + limit)
        $scope.pagination.count = $scope.commands.length
    }

    const checkCommands = function () {
        const now = Date.now()

        for (let i = 0; i < $scope.commands.length; i++) {
            if ($scope.commands[i].model.percent(now) === 100) {
                $scope.commands.splice(i, 1)
            }
        }

        updateVisibileCommands()
    }

    // scope functions

    const toggleFilter = function (type, _filter) {
        attackView.toggleFilter(type, _filter)
        $scope.filters = attackView.getFilters()
    }

    const toggleSorting = function (column) {
        attackView.toggleSorting(column)
        $scope.sorting = attackView.getSortings()
    }

    const eventHandlers = {
        updateCommands: function () {
            $scope.commands = attackView.getCommands()
        },
        onVillageSwitched: function () {
            $scope.selectedVillageId = modelDataService.getSelectedVillage().getId()
        }
    }

    const init = function () {
        $button = interfaceOverflow.addMenuButton('Strażnik', 30)
        $button.addEventListener('click', buildWindow)

        interfaceOverflow.addTemplate('twoverflow_attack_view_main', `<div id=\"two-attack-view\" class=\"win-content two-window\"><header class=\"win-head\"><h2>Strażnik</h2><ul class=\"list-btn\"><li><a href=\"#\" class=\"size-34x34 btn-orange icon-26x26-double-arrow\" ng-click=\"switchWindowSize()\"></a><li><a href=\"#\" class=\"size-34x34 btn-red icon-26x26-close\" ng-click=\"closeWindow()\"></a></ul></header><div class=\"win-main\" scrollbar=\"\"><div class=\"box-paper\"><div class=\"scroll-wrap rich-text\"><div class=\"filters\"><table class=\"tbl-border-light\"><tr><th>{{ 'village' | i18n:loc.ale:'common' }}<tr><td><div class=\"box-border-dark icon\" ng-class=\"{'active': filters[FILTER_TYPES.VILLAGE]}\" ng-click=\"toggleFilter(FILTER_TYPES.VILLAGE)\" tooltip=\"\" tooltip-content=\"{{ 'current_only_tooltip' | i18n:loc.ale:'attack_view' }}\"><span class=\"icon-34x34-village-info icon-bg-black\"></span></div></table><table class=\"tbl-border-light\"><tr><th>{{ 'filter_types' | i18n:loc.ale:'attack_view' }}<tr><td><div class=\"box-border-dark icon\" ng-class=\"{'active': filters[FILTER_TYPES.COMMAND_TYPES][COMMAND_TYPES.ATTACK]}\" ng-click=\"toggleFilter(FILTER_TYPES.COMMAND_TYPES, COMMAND_TYPES.ATTACK)\" tooltip=\"\" tooltip-content=\"{{ 'filter_show_attacks_tooltip' | i18n:loc.ale:'attack_view' }}\"><span class=\"icon-34x34-attack icon-bg-black\"></span></div><div class=\"box-border-dark icon\" ng-class=\"{'active': filters[FILTER_TYPES.COMMAND_TYPES][COMMAND_TYPES.SUPPORT]}\" ng-click=\"toggleFilter(FILTER_TYPES.COMMAND_TYPES, COMMAND_TYPES.SUPPORT)\" tooltip=\"\" tooltip-content=\"{{ 'filter_show_supports_tooltip' | i18n:loc.ale:'attack_view' }}\"><span class=\"icon-34x34-support icon-bg-black\"></span></div><div class=\"box-border-dark icon\" ng-class=\"{'active': filters[FILTER_TYPES.COMMAND_TYPES][COMMAND_TYPES.RELOCATE]}\" ng-click=\"toggleFilter(FILTER_TYPES.COMMAND_TYPES, COMMAND_TYPES.RELOCATE)\" tooltip=\"\" tooltip-content=\"{{ 'filter_show_relocations_tooltip' | i18n:loc.ale:'attack_view' }}\"><span class=\"icon-34x34-relocate icon-bg-black\"></span></div></table><table class=\"tbl-border-light\"><tr><th>{{ 'filter_incoming_units' | i18n:loc.ale:'attack_view' }}<tr><td><div ng-repeat=\"unit in ::UNIT_SPEED_ORDER\" class=\"box-border-dark icon\" ng-class=\"{'active': filters[FILTER_TYPES.INCOMING_UNITS][unit]}\" ng-click=\"toggleFilter(FILTER_TYPES.INCOMING_UNITS, unit)\" tooltip=\"\" tooltip-content=\"{{ unit | i18n:loc.ale:'unit_names' }}\"><span class=\"icon-34x34-unit-{{ unit }} icon-bg-black\"></span></div></table></div><div class=\"page-wrap\" pagination=\"pagination\"></div><p class=\"text-center\" ng-show=\"!visibleCommands.length\">{{ 'no_incoming' | i18n:loc.ale:'attack_view' }}<table class=\"tbl-border-light commands-table\" ng-show=\"visibleCommands.length\"><col width=\"7%\"><col width=\"15%\"><col><col><col width=\"5%\"><col width=\"13%\"><col width=\"29%\"><thead class=\"sorting\"><tr><th ng-click=\"toggleSorting(COLUMN_TYPES.COMMAND_TYPE)\" tooltip=\"\" tooltip-content=\"{{ 'command_type_tooltip' | i18n:loc.ale:'attack_view' }}\">{{ 'command_type' | i18n:loc.ale:'attack_view' }} <span class=\"arrow\" ng-show=\"sorting.column == COLUMN_TYPES.COMMAND_TYPE\" ng-class=\"{'icon-26x26-normal-arrow-down': sorting.reverse, 'icon-26x26-normal-arrow-up': !sorting.reverse}\"></span><th ng-click=\"toggleSorting(COLUMN_TYPES.ORIGIN_CHARACTER)\">{{ 'player' | i18n:loc.ale:'common' }} <span class=\"arrow\" ng-show=\"sorting.column == COLUMN_TYPES.ORIGIN_CHARACTER\" ng-class=\"{'icon-26x26-normal-arrow-down': sorting.reverse, 'icon-26x26-normal-arrow-up': !sorting.reverse}\"></span><th ng-click=\"toggleSorting(COLUMN_TYPES.ORIGIN_VILLAGE)\">{{ 'origin' | i18n:loc.ale:'common' }} <span class=\"arrow\" ng-show=\"sorting.column == COLUMN_TYPES.ORIGIN_VILLAGE\" ng-class=\"{'icon-26x26-normal-arrow-down': sorting.reverse, 'icon-26x26-normal-arrow-up': !sorting.reverse}\"></span><th ng-click=\"toggleSorting(COLUMN_TYPES.TARGET_VILLAGE)\">{{ 'target' | i18n:loc.ale:'common' }} <span class=\"arrow\" ng-show=\"sorting.column == COLUMN_TYPES.TARGET_VILLAGE\" ng-class=\"{'icon-26x26-normal-arrow-down': sorting.reverse, 'icon-26x26-normal-arrow-up': !sorting.reverse}\"></span><th tooltip=\"\" tooltip-content=\"{{ 'slowest_unit_tooltip' | i18n:loc.ale:'attack_view' }}\">{{ 'slowest_unit' | i18n:loc.ale:'attack_view' }}<th ng-click=\"toggleSorting(COLUMN_TYPES.TIME_COMPLETED)\">{{ 'arrive' | i18n:loc.ale:'common' }} <span class=\"arrow\" ng-show=\"sorting.column == COLUMN_TYPES.TIME_COMPLETED\" ng-class=\"{'icon-26x26-normal-arrow-down': sorting.reverse, 'icon-26x26-normal-arrow-up': !sorting.reverse}\"></span><th>{{ 'actions' | i18n:loc.ale:'attack_view' }}<tbody><tr ng-repeat=\"command in visibleCommands\" class=\"{{ command.command_type }}\" ng-class=\"{'snob': command.slowestUnit === UNIT_TYPES.SNOB}\"><td><span class=\"icon-20x20-{{ command.command_type }}\"></span><td ng-click=\"openCharacterProfile(command.originCharacter.id)\" class=\"character\"><span class=\"name\">{{ command.originCharacter.name }}</span><td ng-class=\"{'selected': command.originVillage.id === selectedVillageId}\" class=\"village\"><span class=\"name\" ng-click=\"openVillageInfo(command.originVillage.id)\">{{ command.originVillage.name }}</span> <span class=\"coords\" ng-click=\"jumpToVillage(command.originVillage.x, command.originVillage.y)\">({{ command.originVillage.x }}|{{ command.originVillage.y }})</span><td ng-class=\"{'selected': command.targetVillage.id === selectedVillageId}\" class=\"village\"><span class=\"name\" ng-click=\"openVillageInfo(command.targetVillage.id)\">{{ command.targetVillage.name }}</span> <span class=\"coords\" ng-click=\"jumpToVillage(command.targetVillage.x, command.targetVillage.y)\">({{ command.targetVillage.x }}|{{ command.targetVillage.y }})</span><td><span class=\"icon-20x20-unit-{{ command.slowestUnit }}\"></span><td><div class=\"progress-wrapper\" tooltip=\"\" tooltip-content=\"{{ command.model.arrivalTime() | readableDateFilter:loc.ale:GAME_TIMEZONE:GAME_TIME_OFFSET }}\"><div class=\"progress-bar\" ng-style=\"{width: command.model.percent() + '%'}\"></div><div class=\"progress-text\"><span>{{ command.model.countdown() }}</span></div></div><td><a ng-click=\"copyTimeModal(command.time_completed)\" class=\"btn btn-orange size-20x20 icon-20x20-arrivetime\" tooltip=\"\" tooltip-content=\"{{ 'commands_copy_arrival_tooltip' | i18n:loc.ale:'attack_view' }}\"></a> <a ng-click=\"copyTimeModal(command.time_completed + (command.time_completed - command.time_start))\" class=\"btn btn-red size-20x20 icon-20x20-backtime\" tooltip=\"\" tooltip-content=\"{{ 'commands_copy_backtime_tooltip' | i18n:loc.ale:'attack_view' }}\"></a> <a ng-if=\"commandQueueEnabled\" ng-click=\"removeTroops(command)\" class=\"btn btn-orange size-20x20 icon-20x20-units-outgoing\" tooltip=\"\" tooltip-content=\"{{ 'commands_set_remove_tooltip' | i18n:loc.ale:'attack_view' }}\"></a> <a ng-if=\"commandQueueEnabled\" ng-click=\"killNobleman(command)\" class=\"btn btn-orange size-20x20 icon-20x20-kill\" tooltip=\"\" tooltip-content=\"{{ 'commands_kill_nobleman_tooltip' | i18n:loc.ale:'attack_view' }}\"></a> <a ng-if=\"commandQueueEnabled\" ng-click=\"killNoblemanBig(command)\" class=\"btn btn-red size-20x20 icon-20x20-killBig\" tooltip=\"\" tooltip-content=\"{{ 'commands_kill_noblemanBig_tooltip' | i18n:loc.ale:'attack_view' }}\"></a> <a ng-if=\"commandQueueEnabled\" ng-click=\"bunkerVillage(command)\" class=\"btn btn-red size-20x20 icon-20x20-bunker\" tooltip=\"\" tooltip-content=\"{{ 'commands_bunker_village_tooltip' | i18n:loc.ale:'attack_view' }}\"></a> <a ng-if=\"commandQueueEnabled\" ng-click=\"withdrawArmy(command)\" class=\"btn btn-orange size-20x20 icon-20x20-withdraw\" tooltip=\"\" tooltip-content=\"{{ 'commands_withdraw_army_tooltip' | i18n:loc.ale:'attack_view' }}\"></a> <a ng-if=\"commandQueueEnabled\" ng-click=\"spyVillage(command)\" class=\"btn btn-orange size-20x20 icon-20x20-spy\" tooltip=\"\" tooltip-content=\"{{ 'commands_spy_village_tooltip' | i18n:loc.ale:'attack_view' }}\"></a></table><div class=\"page-wrap\" pagination=\"pagination\"></div></div></div></div></div>`)
        interfaceOverflow.addTemplate('twoverflow_attack_view_show_text_modal', `<div id=\"show-text-modal\" class=\"win-content\"><header class=\"win-head\"><h3>{{ title }}</h3><ul class=\"list-btn sprite\"><li><a href=\"#\" class=\"btn-red icon-26x26-close\" ng-click=\"closeWindow()\"></a></ul></header><div class=\"win-main\" scrollbar=\"\"><div class=\"box-paper\"><div class=\"scroll-wrap\"><form ng-submit=\"closeWindow()\"><input class=\"input-border text-center\" ng-model=\"text\"></form></div></div></div><footer class=\"win-foot sprite-fill\"><ul class=\"list-btn list-center\"><li><a href=\"#\" class=\"btn-green btn-border\" ng-click=\"closeWindow()\">OK</a></ul></footer></div>`)
        interfaceOverflow.addStyle('#two-attack-view table.commands-table{table-layout:fixed;font-size:13px;margin-bottom:10px}#two-attack-view table.commands-table th{text-align:center;padding:0px}#two-attack-view table.commands-table td{padding:1px 0;min-height:initial;border:none;text-align:center}#two-attack-view table.commands-table tr.attack.snob td{background:#bb8658}#two-attack-view table.commands-table tr.support td{background:#6884ea}#two-attack-view table.commands-table tr.relocate td{background:#afea68}#two-attack-view table.commands-table tr.attack.snob td{background:#ea7d69}#two-attack-view table.commands-table tr.attack.trebuchet td{background:#eab268}#two-attack-view table.commands-table tr.attack.tribemate td{background:#cccccc}#two-attack-view table.commands-table .empty td{height:32px}#two-attack-view table.commands-table .sorting .arrow{margin-top:-4px}#two-attack-view .village .coords{font-size:11px;color:#71471a}#two-attack-view .village .coords:hover{color:#ffde00;text-shadow:0 1px 0 #000}#two-attack-view .village .name:hover{color:#fff;text-shadow:0 1px 0 #000}#two-attack-view .village.selected .name{font-weight:bold}#two-attack-view .character .name:hover{color:#fff;text-shadow:1px 1px 0 #000}#two-attack-view .progress-wrapper{height:20px;margin-bottom:0}#two-attack-view .progress-wrapper .progress-text{position:absolute;width:100%;height:100%;text-align:center;z-index:10;padding:0 5px;line-height:20px;color:#f0ffc9;overflow:hidden}#two-attack-view .filters{height:95px;margin-bottom:10px}#two-attack-view .filters table{width:auto;float:left;margin:5px}#two-attack-view .filters .icon{width:38px;float:left;margin:0 6px}#two-attack-view .filters .icon.active:before{box-shadow:0 0 0 1px #000,-1px -1px 0 2px #ac9c44,0 0 0 3px #ac9c44,0 0 0 4px #000;border-radius:1px;content:"";position:absolute;width:38px;height:38px;left:-1px;top:-1px}#two-attack-view .filters td{padding:6px}#two-attack-view .icon-20x20-backtime{background-image:url("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABQAAAAUCAYAAACNiR0NAAAABmJLR0QA/wD/AP+gvaeTAAAEMklEQVQ4y42US2xUdRTGf3funZn/PHqnnVdpKZZ2RCWBVESgoZogSAKKEEAlGhVNLMGg0QiJKxYudIdoTEyDj8SFGo2seDUGhEQqRHk/UimDpdAptHMr8+jM3Dv35QJbi9KEszzJ+eU753z5JKYuOQGBUpAa2SLiuPgBPBKGrZAPlSlmoQLYk4ekqUCmEHHL0pslRb7fsNwWF8L/DIz5Fanftey0oogBr65rk8HS3WC6jyY8ckfZdNtfWdX++tzGIDMabAJmArte4my/l/c//vaLoFc6jmP3iCqD41B5Mi0BId1Hk+V6ljfEQlvWL2xZoY/lKOTLGCY01tZhVLMkRJEtqzoeyUvSnN70SNZRXC1iUylDVZmszhQiDmbH9Lrgpta4mKPlCjy95D6Wrn8GAKFEEfEmdG2Qowd+4I0XFrUC7+w7eL5sCu8hdL3imaQuYFl6c9l021vjYk7Y72Xjq4/z1IaNCCVKMRckq+moiQDJ2bN48uV3GbnSx9b1ra1l0223LL05AYF/Vw4S80jyonnN6paq5YTe3LyU2rpaYrFpJGfPItlcTzI1H8R8cC38NTFiaojhSzeJJ8KNJ/4YOmP43GsTCmWLiGG5LTUBb2LuzGm3e3Ij3321m5Hey6A0AVAcPjmhQcSbuDyU5sF6e5phuS2yRWQC6Lj4x62h1vjJ3BwjlUoiYn52ffolmUtnuXj4ADu2b7/DFoN9RVQ1gAthx8U/+Sk4LiGAQtFAHzXIajpr16yiu/tX98euzyWAzrc6Abj8+1G0TIZ8uYx/xJpgjANlWfEKqjaZbIlixQQgdDHDyuULWLFisZTVdBJxQTIVA2uQ+qZ6KoU0nhqV09f+QoIxj4ThAWRVJWLZToNXUaarYR8Hdm+iZBic7N5LbmgI0xclERcAFLIVAHRtkFOHjwBwNHNryK9I/bZCXlFVIk6ZuSbukidmR1Z+/cliAHzRBjKjBTq37bz9gEAAgA+2vQjAjb4j9F6pUCga/Hzm5v6A5KRDFkXF1UnWRcRj256d/vam9zrJXT0GwGc7V+ONRwAwtTwAa9bs4ND+PTy8MMW5az7+vJ7lXKZ4IeiVjsuIgaylVxTHxf/S84+u3bh5Mbmrx/D6Y1hjGtaYBjduH9g0RonNSmH4o/T1j9JzeoBixSRbsi9ktNIuRXJ6vFVbA2ypVoiZNuay+qj62r6u1R0ee4i65Iw7rDEOnLegC4CSqwxf18b23C0cFMenF5wKJzLZfLDtuW/4pWt1Ry6XY8/ug8jRB6gN3GI0k6VtXcq9csvqtm2rTyjS+YDkpGXEgLdq/z++EhA2hYjbmMtMx7P8+4/Wbdj64U89/cP5Xlli2HGcUsAnjziulMGxbrheRu4lYH21QjSarvXQoraZbQC/nUoflzwMyx6hVz26MRVkysROQNhQ8XmqQr1XwH/rb2Du69Eebp25AAAAAElFTkSuQmCC")}#two-attack-view .icon-20x20-arrivetime{background-image:url("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABQAAAAUCAYAAACNiR0NAAAABmJLR0QA/wD/AP+gvaeTAAAEW0lEQVQ4y4WUWWxUZRiGn7PMnNPOVtvODHQBSlulAUFBoQiEaBHBhCsSFaIhIe6JSyAkRkO8NpErY2KoYuINISkkRFAjEUyAUCQsBSu1BVpKZ2DmTNuZzsyZMz3L70Vbgkjqe/Ul//89//K9eSX+KyUKFcVKQopDxBNoALJE2VXJBUzyBpQA9xG9SA+DbF2vdRxrvqQqLWVHNAkITm8saKo0KBz3hqrqt32WlXkUWHoQZvlpQFbWmLZo//zj7W8ua7JRUoKSz+DOXYVrSZMfjnV/W+mTuvHcs/okIw9DFYAoBCw/DY6QX9yycemer9/p6KiQE7ilIj4vwNXBFIO3M1iFLKta4suNvLUwZzpZTxWZiEvJhMkHgYpf1+cKSazfsnHpnve2rVqYTg2xdvMrPL76JWKNNSxesYB1LyyDiQQ9fWkCmhxzkRuLZTcpVC1lOU4eEDNPDUzitJVc6eUDn6zuSAwl2PDGLqrnx9ECPob6kkxaPiLBEK1LniIaFVz/c4SAJsf6U2ZaEfZwxMOYuaVCJTWypKz68LXV7y6sigWf7thMdfMKkMOgryA2r5pYYwWBaA3FzBhFM8uiRXFOnumn/jGt0SjYl8t+MWzbFABkxSFSdkTTE3F3zkDyBnptw/2J5VMXpwq1gfT1AQ4eOIyi1AHw5II5hCp80bIjmhSHyEyP7Ak0AcFwuIKR/vy/PLVv7156T/1M4u8e9n/1HXqNRnNzjMS9AuGQBlMfF5zxKoA6U2hph5xp0nv+ErX1KVqfXctbH+yk65tOAOa1tolNm56TjIyFNVpmIl8GwBMEHnSzKkuUJUHh8vAYcihMIFQi3hAHZ4T65hq27dyKkbGI1uqS7a/mXO8F+gZGuDZ0j4nClFsU1adj2wrgyq5KTlOlwTOJ8STApVO/Y2VGAJgwSgBEa3VsfzXZZJKLvxyjWC7z8+G3CQf9+FS13nG9ueEwEUBRqmywEfrAvWLF4rqq5fmiwCvcIjuqYCTu8v5nnXQd7+bgoZ/48dduXF8F4ZpaNj0/j60bgly+YLTeNMyUYosxPUhONaBUpeq3K7G7T/Ym2pfWh5ZU1MzBX/0XV/64iVYe4+jR3QD4aqeGaWdylPNjABw9upv9X3R+9GVXwsjmrZQCiJDjOI4scjnTyZZc0ZhKJmM9PcNYlsu4CLJjez3jt65ij45jpZPYhVG8SRNFrcQc7eeZ9evIl9xI96Xh4yqAAaXoJCOW3zuRGjfNwbRob6wNbkkYxTizaDx9B0+pY93rnWdTYxPf+xQ9p0yvCRPciEtJqFpKEfZwyXaupArOYLbM+JK2lS3HDhyRbgwanO6eoPvEaWLxOixLY+WOrrP5onUI4Z2TdMeQZgtYySaGrM6VJVFfmnRjsiwHXEG8KR5p2/fpxjWv7jpyyCd7JxR8v03nY0Fidt2H+z1dcz1LFx7xlctb2gHO9wz1+CS1L2tZSabD4f+Asx7g+a0JbYJJg6lgAPgHUh4QWRIJr4EAAAAASUVORK5CYII=")}#two-attack-view .icon-20x20-spy{background-image:url("https://twxen.innogamescdn.com/img/icons/alpha_907725c8a7.png");background-position:-40px -1130px;height:20px;width:20px}#two-attack-view .icon-20x20-withdraw{background-image:url("https://twxen.innogamescdn.com/img/icons/alpha_907725c8a7.png");background-position:-559px -1130px;height:20px;width:20px}#two-attack-view .icon-20x20-bunker{background-image:url("https://twxen.innogamescdn.com/img/icons/alpha_907725c8a7.png");background-position:-1130px -995px;height:20px;width:20px}#two-attack-view .icon-20x20-kill{background-image:url("https://twxen.innogamescdn.com/img/icons/alpha_907725c8a7.png");background-position:-80px -1130px;height:20px;width:20px}#two-attack-view .icon-20x20-killBig{background-image:url("https://twxen.innogamescdn.com/img/icons/alpha_907725c8a7.png");background-position:-80px -1130px;height:20px;width:20px}')
    }

    const buildWindow = function () {
        $scope = $rootScope.$new()
        $scope.commandQueueEnabled = attackView.commandQueueEnabled()
        $scope.commands = attackView.getCommands()
        $scope.selectedVillageId = modelDataService.getSelectedVillage().getId()
        $scope.filters = attackView.getFilters()
        $scope.sorting = attackView.getSortings()
        $scope.UNIT_TYPES = UNIT_TYPES
        $scope.FILTER_TYPES = FILTER_TYPES
        $scope.COMMAND_TYPES = COMMAND_TYPES
        $scope.UNIT_SPEED_ORDER = UNIT_SPEED_ORDER
        $scope.COLUMN_TYPES = COLUMN_TYPES
        $scope.pagination = {
            count: $scope.commands.length,
            offset: 0,
            loader: updateVisibileCommands,
            limit: storageService.getPaginationLimit()
        }

        // functions
        $scope.openCharacterProfile = windowDisplayService.openCharacterProfile
        $scope.openVillageInfo = windowDisplayService.openVillageInfo
        $scope.jumpToVillage = mapService.jumpToVillage
        $scope.now = nowSeconds
        $scope.copyTimeModal = copyTimeModal
        $scope.removeTroops = removeTroops
        $scope.switchWindowSize = switchWindowSize
        $scope.toggleFilter = toggleFilter
        $scope.toggleSorting = toggleSorting

        updateVisibileCommands()

        let eventScope = new EventScope('twoverflow_queue_window', function onWindowClose() {
            timeHelper.timer.remove(checkCommands)
        })
        eventScope.register(eventTypeProvider.MAP_SELECTED_VILLAGE, eventHandlers.onVillageSwitched, true)
        eventScope.register(eventTypeProvider.ATTACK_VIEW_COMMANDS_LOADED, eventHandlers.updateCommands)
        eventScope.register(eventTypeProvider.ATTACK_VIEW_COMMAND_CANCELLED, eventHandlers.updateCommands)
        eventScope.register(eventTypeProvider.ATTACK_VIEW_COMMAND_IGNORED, eventHandlers.updateCommands)
        eventScope.register(eventTypeProvider.ATTACK_VIEW_VILLAGE_RENAMED, eventHandlers.updateCommands)

        windowManagerService.getScreenWithInjectedScope('!twoverflow_attack_view_main', $scope)

        timeHelper.timer.add(checkCommands)
    }

    return init
})

define('two/attackView/types/columns', [], function () {
    return {
        'ORIGIN_VILLAGE': 'origin_village_name',
        'COMMAND_TYPE': 'command_type',
        'TARGET_VILLAGE': 'target_village_name',
        'TIME_COMPLETED': 'time_completed',
        'ORIGIN_CHARACTER': 'origin_character_name'
    }
})

define('two/attackView/types/commands', [], function () {
    return {
        'ATTACK': 'attack',
        'SUPPORT': 'support',
        'RELOCATE': 'relocate'
    }
})

define('two/attackView/types/filters', [], function () {
    return {
        'COMMAND_TYPES' : 'command_types',
        'VILLAGE' : 'village',
        'INCOMING_UNITS' : 'incoming_units'
    }
})

define('two/attackView/unitSpeedOrder', [
    'conf/unitTypes'
], function (
    UNIT_TYPES
) {
    return [
        UNIT_TYPES.LIGHT_CAVALRY,
        UNIT_TYPES.HEAVY_CAVALRY,
        UNIT_TYPES.AXE,
        UNIT_TYPES.SWORD,
        UNIT_TYPES.RAM,
        UNIT_TYPES.SNOB,
        UNIT_TYPES.TREBUCHET
    ]
})

require([
    'two/ready',
    'two/attackView',
    'two/attackView/ui',
    'two/attackView/events'
], function (
    ready,
    attackView,
    attackViewInterface
) {
    if (attackView.isInitialized()) {
        return false
    }

    ready(function () {
        attackView.init()
        attackViewInterface()
    })
})

define('two/autoCollector', [
    'queues/EventQueue'
], function (
    eventQueue
) {
    let initialized = false
    let running = false

    /**
     * Permite que o evento RESOURCE_DEPOSIT_JOB_COLLECTIBLE seja executado
     * apenas uma vez.
     */
    let recall = true

    /**
     * Next automatic reroll setTimeout ID.
     */
    let nextUpdateId = 0

    /**
     * Inicia um trabalho.
     *
     * @param {Object} job - Dados do trabalho
     */
    const startJob = function (job) {
        socketService.emit(routeProvider.RESOURCE_DEPOSIT_START_JOB, {
            job_id: job.id
        })
    }

    /**
     * Coleta um trabalho.
     *
     * @param {Object} job - Dados do trabalho
     */
    const finalizeJob = function (job) {
        socketService.emit(routeProvider.RESOURCE_DEPOSIT_COLLECT, {
            job_id: job.id,
            village_id: modelDataService.getSelectedVillage().getId()
        })
    }

    /**
     * Força a atualização das informações do depósito.
     */
    const updateDepositInfo = function () {
        socketService.emit(routeProvider.RESOURCE_DEPOSIT_GET_INFO, {})
    }

    /**
     * Faz a analise dos trabalhos sempre que um evento relacionado ao depósito
     * é disparado.
     */
    const analyse = function () {
        if (!running) {
            return false
        }

        let data = modelDataService.getSelectedCharacter().getResourceDeposit()

        if (!data) {
            return false
        }

        if (data.getCurrentJob()) {
            return false
        }

        let collectible = data.getCollectibleJobs()

        if (collectible) {
            return finalizeJob(collectible.shift())
        }

        let ready = data.getReadyJobs()

        if (ready) {
            return startJob(getFastestJob(ready))
        }
    }

    /**
     * Obtem o trabalho de menor duração.
     *
     * @param {Array} jobs - Lista de trabalhos prontos para serem iniciados.
     */
    const getFastestJob = function (jobs) {
        const sorted = jobs.sort(function (a, b) {
            return a.duration - b.duration
        })

        return sorted[0]
    }

    /**
     * Atualiza o timeout para que seja forçado a atualização das informações
     * do depósito quando for resetado.
     * Motivo: só é chamado automaticamente quando um milestone é resetado,
     * e não o diário.
     * 
     * @param {Object} data - Os dados recebidos de RESOURCE_DEPOSIT_INFO
     */
    const rerollUpdater = function (data) {
        const timeLeft = data.time_next_reset * 1000 - Date.now() + 1000

        clearTimeout(nextUpdateId)
        nextUpdateId = setTimeout(updateDepositInfo, timeLeft)
    }

    /**
     * Métodos públicos do AutoCollector.
     *
     * @type {Object}
     */
    let autoCollector = {}

    /**
     * Inicializa o AutoDepois, configura os eventos.
     */
    autoCollector.init = function () {
        initialized = true

        $rootScope.$on(eventTypeProvider.RESOURCE_DEPOSIT_JOB_COLLECTIBLE, function () {
            if (!recall || !running) {
                return false
            }

            recall = false

            setTimeout(function () {
                recall = true
                analyse()
            }, 1500)
        })

        $rootScope.$on(eventTypeProvider.RESOURCE_DEPOSIT_JOBS_REROLLED, analyse)
        $rootScope.$on(eventTypeProvider.RESOURCE_DEPOSIT_JOB_COLLECTED, analyse)
        $rootScope.$on(eventTypeProvider.RESOURCE_DEPOSIT_INFO, function (event, data) {
            analyse()
            rerollUpdater(data)
        })
    }

    /**
     * Inicia a analise dos trabalhos.
     */
    autoCollector.start = function () {
        eventQueue.trigger(eventTypeProvider.AUTO_COLLECTOR_STARTED)
        running = true
        analyse()
    }

    /**
     * Para a analise dos trabalhos.
     */
    autoCollector.stop = function () {
        eventQueue.trigger(eventTypeProvider.AUTO_COLLECTOR_STOPPED)
        running = false
    }

    /**
     * Retorna se o modulo está em funcionamento.
     */
    autoCollector.isRunning = function () {
        return running
    }

    /**
     * Retorna se o modulo está inicializado.
     */
    autoCollector.isInitialized = function () {
        return initialized
    }

    return autoCollector
})

define('two/autoCollector/events', [], function () {
    angular.extend(eventTypeProvider, {
        AUTO_COLLECTOR_STARTED: 'auto_collector_started',
        AUTO_COLLECTOR_STOPPED: 'auto_collector_stopped',
        AUTO_COLLECTOR_SECONDVILLAGE_STARTED: 'auto_collector_secondvillage_started',
        AUTO_COLLECTOR_SECONDVILLAGE_STOPPED: 'auto_collector_secondvillage_stopped'
    })
})

define('two/autoCollector/ui', [
    'two/ui',
    'two/autoCollector',
    'two/utils',
    'queues/EventQueue'
], function (
    interfaceOverflow,
    autoCollector,
    utils,
    eventQueue
) {
    let $button

    const init = function () {
        $button = interfaceOverflow.addMenuButton2('Kolekcjoner', 30, $filter('i18n')('description', $rootScope.loc.ale, 'auto_collector'))
        
        $button.addEventListener('click', function () {
            if (autoCollector.isRunning()) {
                autoCollector.stop()
                autoCollector.secondVillage.stop()
                utils.notif('success', $filter('i18n')('deactivated', $rootScope.loc.ale, 'auto_collector'))
            } else {
                autoCollector.start()
                autoCollector.secondVillage.start()
                utils.notif('success', $filter('i18n')('activated', $rootScope.loc.ale, 'auto_collector'))
            }
        })

        eventQueue.register(eventTypeProvider.AUTO_COLLECTOR_STARTED, function () {
            $button.classList.remove('btn-orange')
            $button.classList.add('btn-red')
        })

        eventQueue.register(eventTypeProvider.AUTO_COLLECTOR_STOPPED, function () {
            $button.classList.remove('btn-red')
            $button.classList.add('btn-orange')
        })

        if (autoCollector.isRunning()) {
            eventQueue.trigger(eventTypeProvider.AUTO_COLLECTOR_STARTED)
        }

        return opener
    }

    return init
})

define('two/autoCollector/secondVillage', [
    'two/autoCollector',
    'two/utils',
    'queues/EventQueue',
    'helper/time',
    'models/SecondVillageModel'
], function (
    autoCollector,
    utils,
    eventQueue,
    $timeHelper,
    SecondVillageModel
) {
    let initialized = false
    let running = false
    let allFinished = false
    let secondVillageService = injector.get('secondVillageService')

    const getRunningJob = function (jobs) {
        const now = Date.now()

        for (let id in jobs) {
            if (jobs[id].time_started && jobs[id].time_completed) {
                if (now < $timeHelper.server2ClientTime(jobs[id].time_completed)) {
                    return jobs[id]
                }
            }
        }

        return false
    }

    const getCollectibleJob = function (jobs) {
        const now = Date.now()

        for (let id in jobs) {
            if (jobs[id].time_started && jobs[id].time_completed) {
                if ((now >= $timeHelper.server2ClientTime(jobs[id].time_completed)) && !jobs[id].collected) {
                    return id
                }
            }
        }

        return false
    }

    const finalizeJob = function (jobId) {
        socketService.emit(routeProvider.SECOND_VILLAGE_COLLECT_JOB_REWARD, {
            village_id: modelDataService.getSelectedVillage().getId(),
            job_id: jobId
        })
    }

    const startJob = function (job, callback) {
        socketService.emit(routeProvider.SECOND_VILLAGE_START_JOB, {
            village_id: modelDataService.getSelectedVillage().getId(),
            job_id: job.id
        }, callback)
    }

    const getFirstJob = function (jobs) {
        let jobId = false

        utils.each(jobs, function (id) {
            jobId = id
            return false
        })

        return jobId
    }

    const updateSecondVillageInfo = function (callback) {
        socketService.emit(routeProvider.SECOND_VILLAGE_GET_INFO, {}, function (data) {
            if (secondVillageService.hasFinishedLastJob(data.jobs)) {
                allFinished = true
                socketService.emit(routeProvider.SECOND_VILLAGE_FINISH_VILLAGE)
                secondVillageCollector.stop()
            } else{
                let model = new SecondVillageModel(data)
                modelDataService.getSelectedCharacter().setSecondVillage(model)
                callback()
            }
        })
    }

    const updateAndAnalyse = function () {
        updateSecondVillageInfo(analyse)
    }

    const analyse = function () {
        let secondVillage = modelDataService.getSelectedCharacter().getSecondVillage()

        if (!running || !secondVillage || !secondVillage.isAvailable()) {
            return false
        }

        const current = getRunningJob(secondVillage.data.jobs)

        if (current) {
            const completed = $timeHelper.server2ClientTime(current.time_completed)
            const nextRun = completed - Date.now() + 1000

            setTimeout(updateAndAnalyse, nextRun)

            return false
        }

        const collectible = getCollectibleJob(secondVillage.data.jobs)
        
        if (collectible) {
            return finalizeJob(collectible)
        }

        const currentDayJobs = secondVillageService.getCurrentDayJobs(secondVillage.data.jobs, secondVillage.data.day)
        const collectedJobs = secondVillageService.getCollectedJobs(secondVillage.data.jobs)
        const resources = modelDataService.getSelectedVillage().getResources().getResources()
        const availableJobs = secondVillageService.getAvailableJobs(currentDayJobs, collectedJobs, resources, [])

        if (availableJobs) {
            const firstJob = getFirstJob(availableJobs)

            startJob(firstJob, function () {
                const job = availableJobs[firstJob]

                if (job) {
                    setTimeout(updateAndAnalyse, (job.duration * 1000) + 1000)
                } else {
                    setTimeout(updateAndAnalyse, 60 * 1000)
                }

            })
        }
    }

    let secondVillageCollector = {}

    secondVillageCollector.start = function () {
        if (!initialized || allFinished) {
            return false
        }

        eventQueue.trigger(eventTypeProvider.AUTO_COLLECTOR_SECONDVILLAGE_STARTED)
        running = true
        updateAndAnalyse()
    }

    secondVillageCollector.stop = function () {
        if (!initialized) {
            return false
        }

        eventQueue.trigger(eventTypeProvider.AUTO_COLLECTOR_SECONDVILLAGE_STOPPED)
        running = false
    }

    secondVillageCollector.isRunning = function () {
        return running
    }

    secondVillageCollector.isInitialized = function () {
        return initialized
    }

    secondVillageCollector.init = function () {
        if (!secondVillageService.isFeatureActive()) {
            return false
        }

        initialized = true

        socketService.emit(routeProvider.SECOND_VILLAGE_GET_INFO, {}, function (data) {
            if (secondVillageService.hasFinishedLastJob(data.jobs)) {
                allFinished = true
                socketService.emit(routeProvider.SECOND_VILLAGE_FINISH_VILLAGE)
            } else {
                $rootScope.$on(eventTypeProvider.SECOND_VILLAGE_VILLAGE_CREATED, updateAndAnalyse)
                $rootScope.$on(eventTypeProvider.SECOND_VILLAGE_JOB_COLLECTED, updateAndAnalyse)
            }
        })
    }

    autoCollector.secondVillage = secondVillageCollector
})

require([
    'two/ready',
    'two/autoCollector',
    'two/autoCollector/ui',
    'Lockr',
    'queues/EventQueue',
    'two/autoCollector/secondVillage',
    'two/autoCollector/events'
], function (
    ready,
    autoCollector,
    autoCollectorInterface,
    Lockr,
    eventQueue
) {
    const STORAGE_KEYS = {
        ACTIVE: 'auto_collector_active'
    }

    if (autoCollector.isInitialized()) {
        return false
    }

    ready(function () {
        autoCollector.init()
        autoCollector.secondVillage.init()
        autoCollectorInterface()
        
        ready(function () {
            if (Lockr.get(STORAGE_KEYS.ACTIVE, false, true)) {
                autoCollector.start()
                autoCollector.secondVillage.start()
            }

            eventQueue.register(eventTypeProvider.AUTO_COLLECTOR_STARTED, function () {
                Lockr.set(STORAGE_KEYS.ACTIVE, true)
            })

            eventQueue.register(eventTypeProvider.AUTO_COLLECTOR_STOPPED, function () {
                Lockr.set(STORAGE_KEYS.ACTIVE, false)
            })
        }, ['initial_village'])
    })
})

define('two/autoFoundator', [
    'two/utils',
    'queues/EventQueue'
], function (
    utils,
    eventQueue
) {
    let initialized = false
    let running = false
	
    let interval = 3000

    const donateTribe = function () {
        if (!running) {
            return false
        }
        console.log('Fundator uruchomiony')
		
        let player = modelDataService.getSelectedCharacter()
        let villages = player.getVillageList()
        villages.forEach(function(village, index) {
            var resources = village.getResources()
            var computed = resources.getComputed()
            var wood = computed.wood
            var clay = computed.clay
            var iron = computed.iron
            var villageWood = wood.currentStock
            var villageClay = clay.currentStock
            var villageIron = iron.currentStock
            var woodCalculated = Math.round(villageWood * 0.02) + 1
            var ironCalculated = Math.round(villageIron * 0.02) + 1
            var clayCalculated = Math.round(villageClay * 0.02) + 1
            setTimeout(function() {
                socketService.emit(routeProvider.TRIBE_SKILL_DONATE, {
                    village_id: village.getId(),
                    crowns: 0,
                    resources: {
                        wood: woodCalculated,
                        clay: clayCalculated,
                        iron: ironCalculated
                    }
                })
            }, index * Math.random() * interval)
            console.log('Wykonano darowizne na plemię: ' + village.getName() + ' drewno: ' + woodCalculated + ', glina: ' + clayCalculated + ', żelazo: ' + ironCalculated)
        })
        setTimeout(doAgain, 1000)
    }

    function doAgain() {
        setTimeout(donateTribe, 3600000)
    }

    let autoFoundator = {}
    autoFoundator.init = function() {
        initialized = true
    }
    autoFoundator.start = function() {
        eventQueue.trigger(eventTypeProvider.AUTO_FOUNDATOR_STARTED)
        running = true
        donateTribe()
    }
    autoFoundator.stop = function() {
        eventQueue.trigger(eventTypeProvider.AUTO_FOUNDATOR_STOPPED)
        running = false
    }
    autoFoundator.isRunning = function() {
        return running
    }
    autoFoundator.isInitialized = function() {
        return initialized
    }
    return autoFoundator
})
define('two/autoFoundator/events', [], function () {
    angular.extend(eventTypeProvider, {
        AUTO_FOUNDATOR_STARTED: 'auto_foundator_started',
        AUTO_FOUNDATOR_STOPPED: 'auto_foundator_stopped'
    })
})

define('two/autoFoundator/ui', [
    'two/ui',
    'two/autoFoundator',
    'two/utils',
    'queues/EventQueue'
], function (
    interfaceOverflow,
    autoFoundator,
    utils,
    eventQueue
) {
    let $button

    const init = function () {
        $button = interfaceOverflow.addMenuButton3('Fundator', 30, $filter('i18n')('description', $rootScope.loc.ale, 'auto_foundator'))

        $button.addEventListener('click', function () {
            if (autoFoundator.isRunning()) {
                autoFoundator.stop()
                utils.notif('success', $filter('i18n')('deactivated', $rootScope.loc.ale, 'auto_foundator'))
            } else {
                autoFoundator.start()
                utils.notif('success', $filter('i18n')('activated', $rootScope.loc.ale, 'auto_foundator'))
            }
        })

        eventQueue.register(eventTypeProvider.AUTO_FOUNDATOR_STARTED, function () {
            $button.classList.remove('btn-orange')
            $button.classList.add('btn-red')
        })

        eventQueue.register(eventTypeProvider.AUTO_FOUNDATOR_STOPPED, function () {
            $button.classList.remove('btn-red')
            $button.classList.add('btn-orange')
        })

        if (autoFoundator.isRunning()) {
            eventQueue.trigger(eventTypeProvider.AUTO_FOUNDATOR_STARTED)
        }

        return opener
    }

    return init
})
require([
    'two/ready',
    'two/autoFoundator',
    'two/autoFoundator/ui',
    'Lockr',
    'queues/EventQueue',
    'two/autoFoundator/events'
], function(
    ready,
    autoFoundator,
    autoFoundatorInterface,
    Lockr,
    eventQueue
) {
    const STORAGE_KEYS = {
        ACTIVE: 'auto_foundator_active'
    }
	
    if (autoFoundator.isInitialized()) {
        return false
    }
    ready(function() {
        autoFoundator.init()
        autoFoundatorInterface()

        ready(function() {
            if (Lockr.get(STORAGE_KEYS.ACTIVE, false, true)) {
                autoFoundator.start()
            }

            eventQueue.register(eventTypeProvider.AUTO_FOUNDATOR_STARTED, function() {
                Lockr.set(STORAGE_KEYS.ACTIVE, true)
            })

            eventQueue.register(eventTypeProvider.AUTO_FOUNDATOR_STOPPED, function() {
                Lockr.set(STORAGE_KEYS.ACTIVE, false)
            })
        }, ['initial_village'])
    })
})
define('two/autoHealer', [
    'two/utils',
    'queues/EventQueue'
], function (
    utils,
    eventQueue
) {
    let initialized = false
    let running = false
	
    let interval = 3000
    let interval1 = 1000

    const healUnits = function () {
        if (!running) {
            return false
        }
        console.log('Medyk uruchomiony')
		
        let player = modelDataService.getSelectedCharacter()
        let villages = player.getVillageList()
        villages.forEach(function(village, index) {
            let hospital = village.hospital
            let patients = hospital.patients
            let healed = patients.healed
            if (healed.length == 0) {
                console.log('W wiosce ' + village.getName() + ' brak jednostek do wyleczenia.')
            } else {
                setTimeout(function() {
                    healed.forEach(function(heal, index) {
                        setTimeout(function() {
                            socketService.emit(routeProvider.HOSPITAL_RELEASE_PATIENT, {
                                village_id: village.getId(),
                                patient_id: heal.id
                            })
                        }, index * interval1)
                        console.log('W wiosce: ' + village.getName() + ' wyleczono: ' + heal.id)
                    })
                }, index * interval)
            }
        })
        utils.notif('success', $filter('i18n')('deactivated', $rootScope.loc.ale, 'auto_healer'))
        console.log('Medyk zatrzymany')
        autoHealer.stop()
    }
    let autoHealer = {}
    autoHealer.init = function() {
        initialized = true
    }
    autoHealer.start = function() {
        eventQueue.trigger(eventTypeProvider.AUTO_HEALER_STARTED)
        running = true
        healUnits()
    }
    autoHealer.stop = function() {
        eventQueue.trigger(eventTypeProvider.AUTO_HEALER_STOPPED)
        running = false
    }
    autoHealer.isRunning = function() {
        return running
    }
    autoHealer.isInitialized = function() {
        return initialized
    }
    return autoHealer
})
define('two/autoHealer/events', [], function () {
    angular.extend(eventTypeProvider, {
        AUTO_HEALER_STARTED: 'auto_healer_started',
        AUTO_HEALER_STOPPED: 'auto_healer_stopped'
    })
})

define('two/autoHealer/ui', [
    'two/ui',
    'two/autoHealer',
    'two/utils',
    'queues/EventQueue'
], function (
    interfaceOverflow,
    autoHealer,
    utils,
    eventQueue
) {
    let $button

    const init = function () {
        $button = interfaceOverflow.addMenuButton('Medyk', 120, $filter('i18n')('description', $rootScope.loc.ale, 'auto_healer'))

        $button.addEventListener('click', function () {
            if (autoHealer.isRunning()) {
                autoHealer.stop()
                utils.notif('success', $filter('i18n')('deactivated', $rootScope.loc.ale, 'auto_healer'))
            } else {
                autoHealer.start()
                utils.notif('success', $filter('i18n')('activated', $rootScope.loc.ale, 'auto_healer'))
            }
        })

        eventQueue.register(eventTypeProvider.AUTO_HEALER_STARTED, function () {
            $button.classList.remove('btn-orange')
            $button.classList.add('btn-red')
        })

        eventQueue.register(eventTypeProvider.AUTO_HEALER_STOPPED, function () {
            $button.classList.remove('btn-red')
            $button.classList.add('btn-orange')
        })

        if (autoHealer.isRunning()) {
            eventQueue.trigger(eventTypeProvider.AUTO_HEALER_STARTED)
        }

        return opener
    }

    return init
})
require([
    'two/ready',
    'two/autoHealer',
    'two/autoHealer/ui',
    'Lockr',
    'queues/EventQueue',
    'two/autoHealer/events'
], function(
    ready,
    autoHealer,
    autoHealerInterface,
    Lockr,
    eventQueue
) {
    const STORAGE_KEYS = {
        ACTIVE: 'auto_healer_active'
    }
	
    if (autoHealer.isInitialized()) {
        return false
    }
    ready(function() {
        autoHealer.init()
        autoHealerInterface()

        ready(function() {
            if (Lockr.get(STORAGE_KEYS.ACTIVE, false, true)) {
                autoHealer.start()
            }

            eventQueue.register(eventTypeProvider.AUTO_HEALER_STARTED, function() {
                Lockr.set(STORAGE_KEYS.ACTIVE, true)
            })

            eventQueue.register(eventTypeProvider.AUTO_HEALER_STOPPED, function() {
                Lockr.set(STORAGE_KEYS.ACTIVE, false)
            })
        }, ['initial_village'])
    })
})
define('two/autoWithdraw', [
    'two/utils',
    'queues/EventQueue'
], function (
    utils,
    eventQueue
) {
    let initialized = false
    let running = false

    let autoWithdraw = {}
    autoWithdraw.init = function() {
        initialized = true
    }
    autoWithdraw.start = function() {
        eventQueue.trigger(eventTypeProvider.AUTO_WITHDRAW_STARTED)
        running = true
    }
    autoWithdraw.stop = function() {
        eventQueue.trigger(eventTypeProvider.AUTO_WITHDRAW_STOPPED)
        running = false
    }
    autoWithdraw.isRunning = function() {
        return running
    }
    autoWithdraw.isInitialized = function() {
        return initialized
    }
    return autoWithdraw
})
define('two/autoWithdraw/events', [], function () {
    angular.extend(eventTypeProvider, {
        AUTO_WITHDRAW_STARTED: 'auto_withdraw_started',
        AUTO_WITHDRAW_STOPPED: 'auto_withdraw_stopped'
    })
})

define('two/autoWithdraw/ui', [
    'two/ui',
    'two/autoWithdraw',
    'two/utils',
    'queues/EventQueue'
], function (
    interfaceOverflow,
    autoWithdraw,
    utils,
    eventQueue
) {
    let $button

    const init = function () {
        $button = interfaceOverflow.addMenuButton('Dezerter', 40, $filter('i18n')('description', $rootScope.loc.ale, 'auto_withdraw'))

        $button.addEventListener('click', function () {
            if (autoWithdraw.isRunning()) {
                autoWithdraw.stop()
                utils.notif('success', $filter('i18n')('deactivated', $rootScope.loc.ale, 'auto_withdraw'))
            } else {
                autoWithdraw.start()
                utils.notif('success', $filter('i18n')('activated', $rootScope.loc.ale, 'auto_withdraw'))
            }
        })

        eventQueue.register(eventTypeProvider.AUTO_WITHDRAW_STARTED, function () {
            $button.classList.remove('btn-orange')
            $button.classList.add('btn-red')
        })

        eventQueue.register(eventTypeProvider.AUTO_WITHDRAW_STOPPED, function () {
            $button.classList.remove('btn-red')
            $button.classList.add('btn-orange')
        })

        if (autoWithdraw.isRunning()) {
            eventQueue.trigger(eventTypeProvider.AUTO_WITHDRAW_STARTED)
        }

        return opener
    }

    return init
})
require([
    'two/ready',
    'two/autoWithdraw',
    'two/autoWithdraw/ui',
    'Lockr',
    'queues/EventQueue',
    'two/autoWithdraw/events'
], function(
    ready,
    autoWithdraw,
    autoWithdrawInterface,
    Lockr,
    eventQueue
) {
    const STORAGE_KEYS = {
        ACTIVE: 'auto_withdraw_active'
    }
	
    if (autoWithdraw.isInitialized()) {
        return false
    }
    ready(function() {
        autoWithdraw.init()
        autoWithdrawInterface()

        ready(function() {
            if (Lockr.get(STORAGE_KEYS.ACTIVE, false, true)) {
                autoWithdraw.start()
            }

            eventQueue.register(eventTypeProvider.AUTO_WITHDRAW_STARTED, function() {
                Lockr.set(STORAGE_KEYS.ACTIVE, true)
            })

            eventQueue.register(eventTypeProvider.AUTO_WITHDRAW_STOPPED, function() {
                Lockr.set(STORAGE_KEYS.ACTIVE, false)
            })
        }, ['initial_village'])
    })
})
define('two/battleCalculator', [
    'two/Settings',
    'two/battleCalculator/settings',
    'two/battleCalculator/settings/map',
    'two/battleCalculator/settings/updates',
    'two/battleCalculator/types/item',
    'two/battleCalculator/types/level',
    'two/battleCalculator/types/catapult-target',
    'two/battleCalculator/types/order',
    'two/battleCalculator/types/wall',
    'two/battleCalculator/types/church',
    'two/battleCalculator/types/weapon-master',
    'two/battleCalculator/types/iron-walls',
    'two/battleCalculator/types/clinique',
    'two/battleCalculator/types/hospital',
    'two/battleCalculator/types/training',
    'two/ready',
    'queues/EventQueue'
], function (
    Settings,
    SETTINGS,
    SETTINGS_MAP,
    UPDATES,
    B_ITEMS,
    B_ITEMS_LEVELS,
    B_CAT_TARGET,
    T_ORDER_TYPE,
    B_WALLS,
    B_CHURCHES,
    B_SKILL_WEAPON_MASTER_LEVEL,
    B_SKILL_IRON_WALLS_LEVEL,
    B_SKILL_CLINIQUE_LEVEL,
    B_HOSPITAL_LEVEL,
    T_TRAINING_LEVEL,
    ready,
    eventQueue
) {
    let initialized = false
    let running = false
    let settings
    let battleCalculatorSettings
	

    const STORAGE_KEYS = {
        SETTINGS: 'battle_calculator_settings'
    }
	
    const BATTLE_ITEMS_LEVELS = {
        [B_ITEMS_LEVELS.LEVEL_1]: 1,
        [B_ITEMS_LEVELS.LEVEL_2]: 2,
        [B_ITEMS_LEVELS.LEVEL_3]: 3
    }
	
    const BATTLE_ITEMS = {
        [B_ITEMS.HALBERD_OF_GUAN_YU]: 'spear',
        [B_ITEMS.PARACELSUS_LONGSWORD]: 'sword',
        [B_ITEMS.THORGARDS_BATTLE_AXE]: 'axe',
        [B_ITEMS.NIMRODS_LONGBOW]: 'archer',
        [B_ITEMS.MIESZKOS_LANCE]: 'lc',
        [B_ITEMS.NIMRODS_COMPOSITE_BOW]: 'ma',
        [B_ITEMS.BAPTISTES_BANNER]: 'hc',
        [B_ITEMS.CAROLS_MORNING_STAR]: 'ram',
        [B_ITEMS.ALETHEIAS_BONFIRE]: 'catapult',
        [B_ITEMS.VASCOS_SCEPTER]: 'snob'
    }
	
    const BATTLE_CAT_TARGET = {
        [B_CAT_TARGET.HEADQUARTER]: 'headquarter',
        [B_CAT_TARGET.WAREHOUSE]: 'warehouse',
        [B_CAT_TARGET.FARM]: 'farm',
        [B_CAT_TARGET.RALLY_POINT]: 'rally_point',
        [B_CAT_TARGET.STATUE]: 'statue',
        [B_CAT_TARGET.WALL]: 'wall',
        [B_CAT_TARGET.TAVERN]: 'tavern',
        [B_CAT_TARGET.BARRACKS]: 'barracks',
        [B_CAT_TARGET.PRECEPTORY]: 'preceptory',
        [B_CAT_TARGET.HOSPITAL]: 'hospital',
        [B_CAT_TARGET.CLAY_PIT]: 'clay_pit',
        [B_CAT_TARGET.IRON_MINE]: 'iron_mine',
        [B_CAT_TARGET.TIMBER_CAMP]: 'timber_camp',
        [B_CAT_TARGET.CHAPEL]: 'chapel',
        [B_CAT_TARGET.CHURCH]: 'church',
        [B_CAT_TARGET.MARKET]: 'market',
        [B_CAT_TARGET.ACADEMY]: 'academy'
    }
	
    const TROOPS_ORDER_TYPE = {
        [T_ORDER_TYPE.TEUTONIC_ORDER]: 'teutonic',
        [T_ORDER_TYPE.TEMPLAR_ORDER]: 'templar'
    }
	
    const BATTLE_CHURCHES = {
        [B_CHURCHES.NO_CHURCH]: 50,
        [B_CHURCHES.LEVEL_1]: 100,
        [B_CHURCHES.LEVEL_2]: 105,
        [B_CHURCHES.LEVEL_3]: 110
    }
	
    const BATTLE_WALLS = {
        [B_WALLS.NO_WALL]: 0,
        [B_WALLS.LEVEL_1]: 5,
        [B_WALLS.LEVEL_2]: 10,
        [B_WALLS.LEVEL_3]: 15,
        [B_WALLS.LEVEL_4]: 20,
        [B_WALLS.LEVEL_5]: 25,
        [B_WALLS.LEVEL_6]: 30,
        [B_WALLS.LEVEL_7]: 35,
        [B_WALLS.LEVEL_8]: 40,
        [B_WALLS.LEVEL_9]: 45,
        [B_WALLS.LEVEL_10]: 50,
        [B_WALLS.LEVEL_11]: 55,
        [B_WALLS.LEVEL_12]: 60,
        [B_WALLS.LEVEL_13]: 65,
        [B_WALLS.LEVEL_14]: 70,
        [B_WALLS.LEVEL_15]: 75,
        [B_WALLS.LEVEL_16]: 80,
        [B_WALLS.LEVEL_17]: 85,
        [B_WALLS.LEVEL_18]: 90,
        [B_WALLS.LEVEL_19]: 95,
        [B_WALLS.LEVEL_20]: 100
    }
	
    const BATTLE_SKILL_WEAPON_MASTER_LEVEL = {
        [B_SKILL_WEAPON_MASTER_LEVEL.LEVEL_1]: 2,
        [B_SKILL_WEAPON_MASTER_LEVEL.LEVEL_2]: 4,
        [B_SKILL_WEAPON_MASTER_LEVEL.LEVEL_3]: 6,
        [B_SKILL_WEAPON_MASTER_LEVEL.LEVEL_4]: 8,
        [B_SKILL_WEAPON_MASTER_LEVEL.LEVEL_5]: 10
    }
	
    const BATTLE_SKILL_IRON_WALLS_LEVEL = {
        [B_SKILL_IRON_WALLS_LEVEL.LEVEL_1]: 1,
        [B_SKILL_IRON_WALLS_LEVEL.LEVEL_2]: 2,
        [B_SKILL_IRON_WALLS_LEVEL.LEVEL_3]: 3,
        [B_SKILL_IRON_WALLS_LEVEL.LEVEL_4]: 4,
        [B_SKILL_IRON_WALLS_LEVEL.LEVEL_5]: 5
    }
	
    const BATTLE_SKILL_CLINIQUE_LEVEL = {
        [B_SKILL_CLINIQUE_LEVEL.LEVEL_1]: 100,
        [B_SKILL_CLINIQUE_LEVEL.LEVEL_2]: 200,
        [B_SKILL_CLINIQUE_LEVEL.LEVEL_3]: 300,
        [B_SKILL_CLINIQUE_LEVEL.LEVEL_4]: 400,
        [B_SKILL_CLINIQUE_LEVEL.LEVEL_5]: 500,
        [B_SKILL_CLINIQUE_LEVEL.LEVEL_6]: 600,
        [B_SKILL_CLINIQUE_LEVEL.LEVEL_7]: 700,
        [B_SKILL_CLINIQUE_LEVEL.LEVEL_8]: 800,
        [B_SKILL_CLINIQUE_LEVEL.LEVEL_9]: 900,
        [B_SKILL_CLINIQUE_LEVEL.LEVEL_10]: 1000
    }
	
    const BATTLE_HOSPITAL_LEVEL = {
        [B_HOSPITAL_LEVEL.LEVEL_1]: 100,
        [B_HOSPITAL_LEVEL.LEVEL_2]: 129,
        [B_HOSPITAL_LEVEL.LEVEL_3]: 167,
        [B_HOSPITAL_LEVEL.LEVEL_4]: 215,
        [B_HOSPITAL_LEVEL.LEVEL_5]: 278,
        [B_HOSPITAL_LEVEL.LEVEL_6]: 359,
        [B_HOSPITAL_LEVEL.LEVEL_7]: 464,
        [B_HOSPITAL_LEVEL.LEVEL_8]: 599,
        [B_HOSPITAL_LEVEL.LEVEL_9]: 774,
        [B_HOSPITAL_LEVEL.LEVEL_10]: 1000
    }
	
    const TROOPS_TRAINING_LEVEL = {
        [T_TRAINING_LEVEL.LEVEL_1]: 4,
        [T_TRAINING_LEVEL.LEVEL_2]: 8,
        [T_TRAINING_LEVEL.LEVEL_3]: 12,
        [T_TRAINING_LEVEL.LEVEL_4]: 16,
        [T_TRAINING_LEVEL.LEVEL_5]: 20
    }
	
    console.log(TROOPS_ORDER_TYPE, TROOPS_TRAINING_LEVEL, BATTLE_HOSPITAL_LEVEL, BATTLE_SKILL_CLINIQUE_LEVEL, BATTLE_SKILL_IRON_WALLS_LEVEL, BATTLE_SKILL_WEAPON_MASTER_LEVEL, BATTLE_WALLS, BATTLE_CHURCHES, BATTLE_ITEMS_LEVELS, BATTLE_ITEMS, BATTLE_CAT_TARGET)

    const battleCalculator = {}

    battleCalculator.init = function () {
        initialized = true

        settings = new Settings({
            settingsMap: SETTINGS_MAP,
            storageKey: STORAGE_KEYS.SETTINGS
        })

        battleCalculatorSettings = settings.getAll()

        console.log('all settings', battleCalculatorSettings)

    }

    battleCalculator.start = function () {
        running = true


        eventQueue.trigger(eventTypeProvider.BATTLE_CALCULATOR_START)
    }

    battleCalculator.stop = function () {
        running = false

        console.log('example module stop')

        eventQueue.trigger(eventTypeProvider.BATTLE_CALCULATOR_STOP)
    }

    battleCalculator.getSettings = function () {
        return settings
    }

    battleCalculator.isInitialized = function () {
        return initialized
    }

    battleCalculator.isRunning = function () {
        return running
    }

    return battleCalculator
})

define('two/battleCalculator/events', [], function () {
    angular.extend(eventTypeProvider, {
        BATTLE_CALCULATOR_START: 'battle_calculator_start',
        BATTLE_CALCULATOR_STOP: 'battle_calculator_stop'
    })
})

define('two/battleCalculator/ui', [
    'two/ui',
    'two/battleCalculator',
    'two/battleCalculator/settings',
    'two/battleCalculator/settings/map',
    'two/battleCalculator/types/item',
    'two/battleCalculator/types/level',
    'two/battleCalculator/types/catapult-target',
    'two/battleCalculator/types/order',
    'two/battleCalculator/types/wall',
    'two/battleCalculator/types/church',
    'two/battleCalculator/types/weapon-master',
    'two/battleCalculator/types/iron-walls',
    'two/battleCalculator/types/clinique',
    'two/battleCalculator/types/hospital',
    'two/battleCalculator/types/training',
    'two/Settings',
    'two/EventScope',
    'two/utils'
], function (
    interfaceOverflow,
    battleCalculator,
    SETTINGS,
    SETTINGS_MAP,
    B_ITEMS,
    B_ITEMS_LEVELS,
    B_CAT_TARGET,
    T_ORDER_TYPE,
    B_WALLS,
    B_CHURCHES,
    B_SKILL_WEAPON_MASTER_LEVEL,
    B_SKILL_IRON_WALLS_LEVEL,
    B_SKILL_CLINIQUE_LEVEL,
    B_HOSPITAL_LEVEL,
    T_TRAINING_LEVEL,
    Settings,
    EventScope,
    utils
) {
    let $scope
    let settings
    let $button
    
    const TAB_TYPES = {
        BATTLE: 'battle',
        TROOPS: 'troops',
        BASHPOINTS: 'bashpoints'
    }

    const selectTab = function (tabType) {
        $scope.selectedTab = tabType
    }

    const saveSettings = function () {
        settings.setAll(settings.decode($scope.settings))

        utils.notif('success', 'Settings saved')
    }

    const switchState = function () {
        if (battleCalculator.isRunning()) {
            battleCalculator.stop()
        } else {
            battleCalculator.start()
        }
    }

    const eventHandlers = {
        start: function () {
            $scope.running = true

            $button.classList.remove('btn-orange')
            $button.classList.add('btn-red')

            utils.notif('success', 'Example module started')
        },
        stop: function () {
            $scope.running = false

            $button.classList.remove('btn-red')
            $button.classList.add('btn-orange')

            utils.notif('success', 'Example module stopped')
        }
    }

    const init = function () {
        settings = battleCalculator.getSettings()
        $button = interfaceOverflow.addMenuButton4('Kalkulator', 10)
        $button.addEventListener('click', buildWindow)

        interfaceOverflow.addTemplate('twoverflow_battle_calculator_window', `<div id=\"two-battle-calculator\" class=\"win-content two-window\"><header class=\"win-head\"><h2>Kalkulator</h2><ul class=\"list-btn\"><li><a href=\"#\" class=\"size-34x34 btn-red icon-26x26-close\" ng-click=\"closeWindow()\"></a></ul></header><div class=\"win-main\" scrollbar=\"\"><div class=\"tabs tabs-bg\"><div class=\"tabs-three-col\"><div class=\"tab\" ng-click=\"selectTab(TAB_TYPES.BATTLE)\" ng-class=\"{'tab-active': selectedTab == TAB_TYPES.BATTLE}\"><div class=\"tab-inner\"><div ng-class=\"{'box-border-light': selectedTab === TAB_TYPES.BATTLE}\"><a href=\"#\" ng-class=\"{'btn-icon btn-orange': selectedTab !== TAB_TYPES.BATTLE}\">{{ 'battle' | i18n:loc.ale:'battle_calculator' }}</a></div></div></div><div class=\"tab\" ng-click=\"selectTab(TAB_TYPES.TROOPS)\" ng-class=\"{'tab-active': selectedTab == TAB_TYPES.TROOPS}\"><div class=\"tab-inner\"><div ng-class=\"{'box-border-light': selectedTab === TAB_TYPES.TROOPS}\"><a href=\"#\" ng-class=\"{'btn-icon btn-orange': selectedTab !== TAB_TYPES.TROOPS}\">{{ 'troops' | i18n:loc.ale:'battle_calculator' }}</a></div></div></div><div class=\"tab\" ng-click=\"selectTab(TAB_TYPES.BASHPOINTS)\" ng-class=\"{'tab-active': selectedTab == TAB_TYPES.BASHPOINTS}\"><div class=\"tab-inner\"><div ng-class=\"{'box-border-light': selectedTab === TAB_TYPES.BASHPOINTS}\"><a href=\"#\" ng-class=\"{'btn-icon btn-orange': selectedTab !== TAB_TYPES.BASHPOINTS}\">{{ 'bashpoints' | i18n:loc.ale:'battle_calculator' }}</a></div></div></div></div></div><div class=\"box-paper footer\"><div class=\"scroll-wrap\"><div class=\"settings\" ng-show=\"selectedTab === TAB_TYPES.BATTLE\"><h5 class=\"twx-section\">{{ 'battle.header' | i18n:loc.ale:'battle_calculator' }}</h5><form class=\"addForm\"><table class=\"table table_vertical\" id=\"simulation_result\"><col><col width=\"34px\"><col width=\"34px\"><col width=\"34px\"><col width=\"34px\"><col width=\"34px\"><col width=\"34px\"><col width=\"34px\"><col width=\"34px\"><col width=\"34px\"><col width=\"34px\"><col width=\"34px\"><col width=\"34px\"><col width=\"34px\"><tr><th colspan=\"14\">{{ 'battle.attacker' | i18n:loc.ale:'battle_calculator' }}<tr><td style=\"padding-left:5px;\"><div style=\"height:34px;line-height:34px;\"><span class=\"unitname\">{{ 'battle.unit' | i18n:loc.ale:'battle_calculator' }}</span></div><div height=\"26px\"><span class=\"icon-20x20-report-amount\"></span><span class=\"unitname\"> {{ 'battle.amount' | i18n:loc.ale:'battle_calculator' }}</span></div><div height=\"26px\"><span class=\"icon-20x20-report-losses\"></span><span class=\"unitname\"> {{ 'battle.loses' | i18n:loc.ale:'battle_calculator' }}</span></div><div height=\"26px\"><span class=\"icon-20x20-report-revive\"></span><span class=\"unitname\"> {{ 'battle.revived' | i18n:loc.ale:'battle_calculator' }}</span></div><div height=\"26px\"><span class=\"unitname\" tooltip=\"\" tooltip-content=\"{{ 'battle.survivorsA' | i18n:loc.ale:'battle_calculator' }}\">{{ 'battle.survivors' | i18n:loc.ale:'battle_calculator' }}</span></div><td><span class=\"icon-bg-black icon-34x34-unit-spear\"></span><div style=\"text-align:center;\"><span id=\"spearA-amount\" class=\"spearA-amount\">0</span></div><div style=\"text-align:center;color:#a1251f\"><span id=\"spearA-losses\" class=\"spearA-losses\">0</span></div><div style=\"text-align:center;color:#009fff\"><span id=\"spearA-revived\" class=\"spearA-revived\">0</span></div><div style=\"text-align:center;color:#000000\"><span id=\"spearA-survived\" class=\"spearA-survived\">0</span></div><td><span class=\"icon-bg-black icon-34x34-unit-sword\"></span><div style=\"text-align:center;\"><span id=\"swordA-amount\" class=\"swordA-amount\">0</span></div><div style=\"text-align:center;color:#a1251f\"><span id=\"swordA-losses\" class=\"swordA-losses\" style=\"text-align:center;color:#a1251f\">0</span></div><div style=\"text-align:center;color:#009fff\"><span id=\"swordA-revived\" class=\"swordA-revived\" style=\"text-align:center;color:#009fff\">0</span></div><div style=\"text-align:center;color:#000000\"><span id=\"swordA-survived\" class=\"swordA-survived\" style=\"text-align:center;color:#000000\">0</span></div><td><span class=\"icon-bg-black icon-34x34-unit-axe\"></span><div style=\"text-align:center;\"><span id=\"axeA-amount\" class=\"axeA-amount\" style=\"text-align:center;\">0</span></div><div style=\"text-align:center;color:#a1251f\"><span id=\"axeA-losses\" class=\"axeA-losses\" style=\"text-align:center;color:#a1251f\">0</span></div><div style=\"text-align:center;color:#009fff\"><span id=\"axeA-revived\" class=\"axeA-revived\" style=\"text-align:center;color:#009fff\">0</span></div><div style=\"text-align:center;color:#000000\"><span id=\"axeA-survived\" class=\"axeA-survived\" style=\"text-align:center;color:#000000\">0</span></div><td><span class=\"icon-bg-black icon-34x34-unit-archer\"></span><div style=\"text-align:center;\"><span id=\"archerA-amount\" class=\"archerA-amount\" style=\"text-align:center;\">0</span></div><div style=\"text-align:center;color:#a1251f\"><span id=\"archerA-losses\" class=\"archerA-losses\" style=\"text-align:center;color:#a1251f\">0</span></div><div style=\"text-align:center;color:#009fff\"><span id=\"archerA-revived\" class=\"archerA-revived\" style=\"text-align:center;color:#009fff\">0</span></div><div style=\"text-align:center;color:#000000\"><span id=\"archerA-survived\" class=\"archerA-survived\" style=\"text-align:center;color:#000000\">0</span></div><td><span class=\"icon-bg-black icon-34x34-unit-light_cavalry\"></span><div style=\"text-align:center;\"><span id=\"lcA-amount\" class=\"lcA-amount\" style=\"text-align:center;\">0</span></div><div style=\"text-align:center;color:#a1251f\"><span id=\"lcA-losses\" class=\"lcA-losses\" style=\"text-align:center;color:#a1251f\">0</span></div><div style=\"text-align:center;color:#009fff\"><span id=\"lcA-revived\" class=\"lcA-revived\" style=\"text-align:center;color:#009fff\">0</span></div><div style=\"text-align:center;color:#000000\"><span id=\"lcA-survived\" class=\"lcA-survived\" style=\"text-align:center;color:#000000\">0</span></div><td><span class=\"icon-bg-black icon-34x34-unit-mounted_archer\"></span><div style=\"text-align:center;\"><span id=\"maA-amount\" class=\"maA-amount\" style=\"text-align:center;\">0</span></div><div style=\"text-align:center;color:#a1251f\"><span id=\"maA-losses\" class=\"maA-losses\" style=\"text-align:center;color:#a1251f\">0</span></div><div style=\"text-align:center;color:#009fff\"><span id=\"maA-revived\" class=\"maA-revived\" style=\"text-align:center;color:#009fff\">0</span></div><div style=\"text-align:center;color:#000000\"><span id=\"maA-survived\" class=\"maA-survived\" style=\"text-align:center;color:#000000\">0</span></div><td><span class=\"icon-bg-black icon-34x34-unit-heavy_cavalry\"></span><div style=\"text-align:center;\"><span id=\"hcA-amount\" class=\"hcA-amount\" style=\"text-align:center;\">0</span></div><div style=\"text-align:center;color:#a1251f\"><span id=\"hcA-losses\" class=\"hcA-losses\" style=\"text-align:center;color:#a1251f\">0</span></div><div style=\"text-align:center;color:#009fff\"><span id=\"hcA-revived\" class=\"hcA-revived\" style=\"text-align:center;color:#009fff\">0</span></div><div style=\"text-align:center;color:#000000\"><span id=\"hcA-survived\" class=\"hcA-survived\" style=\"text-align:center;color:#000000\">0</span></div><td><span class=\"icon-bg-black icon-34x34-unit-ram\"></span><div style=\"text-align:center;\"><span id=\"ramA-amount\" class=\"ramA-amount\" style=\"text-align:center;\">0</span></div><div style=\"text-align:center;color:#a1251f\"><span id=\"ramA-losses\" class=\"ramA-losses\" style=\"text-align:center;color:#a1251f\">0</span></div><div style=\"text-align:center;color:#009fff\"><span id=\"ramA-revived\" class=\"ramA-revived\" style=\"text-align:center;color:#009fff\">0</span></div><div style=\"text-align:center;color:#000000\"><span id=\"ramA-survived\" class=\"ramA-survived\" style=\"text-align:center;color:#000000\">0</span></div><td><span class=\"icon-bg-black icon-34x34-unit-catapult\"></span><div style=\"text-align:center;\"><span id=\"catapultA-amount\" class=\"catapultA-amount\" style=\"text-align:center;\">0</span></div><div style=\"text-align:center;color:#a1251f\"><span id=\"catapultA-losses\" class=\"catapultA-losses\" style=\"text-align:center;color:#a1251f\">0</span></div><div style=\"text-align:center;color:#009fff\"><span id=\"catapultA-revived\" class=\"catapultA-revived\" style=\"text-align:center;color:#009fff\">0</span></div><div style=\"text-align:center;color:#000000\"><span id=\"catapultA-survived\" class=\"catapultA-survived\" style=\"text-align:center;color:#000000\">0</span></div><td><span class=\"icon-bg-black icon-34x34-unit-doppelsoldner\"></span><div style=\"text-align:center;\"><span id=\"berserkerA-amount\" class=\"berserkerA-amount\" style=\"text-align:center;\">0</span></div><div style=\"text-align:center;color:#a1251f\"><span id=\"berserkerA-losses\" class=\"berserkerA-losses\" style=\"text-align:center;color:#a1251f\">0</span></div><div style=\"text-align:center;color:#009fff\"><span id=\"berserkerA-revived\" class=\"berserkerA-revived\" style=\"text-align:center;color:#009fff\">0</span></div><div style=\"text-align:center;color:#000000\"><span id=\"berserkerA-survived\" class=\"berserkerA-survived\" style=\"text-align:center;color:#000000\">0</span></div><td><span class=\"icon-bg-black icon-34x34-unit-trebuchet\"></span><div style=\"text-align:center;\"><span id=\"trebuchetA-amount\" class=\"trebuchetA-amount\" style=\"text-align:center;\">0</span></div><div style=\"text-align:center;color:#a1251f\"><span id=\"trebuchetA-losses\" class=\"trebuchetA-losses\" style=\"text-align:center;color:#a1251f\">0</span></div><div style=\"text-align:center;color:#009fff\"><span id=\"trebuchetA-revived\" class=\"trebuchetA-revived\" style=\"text-align:center;color:#009fff\">0</span></div><div style=\"text-align:center;color:#000000\"><span id=\"trebuchetA-survived\" class=\"trebuchetA-survived\" style=\"text-align:center;color:#000000\">0</span></div><td><span class=\"icon-bg-black icon-34x34-unit-snob\"></span><div style=\"text-align:center;\"><span id=\"snobA-amount\" class=\"snobA-amount\" style=\"text-align:center;\">0</span></div><div style=\"text-align:center;color:#a1251f\"><span id=\"snobA-losses\" class=\"snobA-losses\" style=\"text-align:center;color:#a1251f\">0</span></div><div style=\"text-align:center;color:#009fff\"><span id=\"snobA-revived\" class=\"snobA-revived\" style=\"text-align:center;color:#009fff\">0</span></div><div style=\"text-align:center;color:#000000\"><span id=\"snobA-survived\" class=\"snobA-survived\" style=\"text-align:center;color:#000000\">0</span></div><td><span class=\"icon-bg-black icon-34x34-unit-knight\"></span><div style=\"text-align:center;\"><span id=\"knightA-amount\" class=\"knightA-amount\" style=\"text-align:center;\">0</span></div><div style=\"text-align:center;color:#a1251f\"><span id=\"knightA-losses\" class=\"knightA-losses\" style=\"text-align:center;color:#a1251f\">0</span></div><div style=\"text-align:center;color:#009fff\"><span id=\"knightA-revived\" class=\"knightA-revived\" style=\"text-align:center;color:#009fff\">0</span></div><div style=\"text-align:center;color:#000000\"><span id=\"knightA-survived\" class=\"knightA-survived\" style=\"text-align:center;color:#000000\">0</span></div><tr><td colspan=\"2\"><span style=\"float:left\" class=\"icon-bg-red icon-34x34-attack\" tooltip=\"\" tooltip-content=\"{{ 'battle.attackModifier' | i18n:loc.ale:'battle_calculator' }}\"></span><div class=\"center-34x\"><span class=\"attackModifier\"></span></div><td colspan=\"6\"><span style=\"float:left\" class=\"icon-bg-black icon-34x34-resource-food\" tooltip=\"\" tooltip-content=\"{{ 'battle.provisions' | i18n:loc.ale:'battle_calculator' }}\"></span><div class=\"center-34x\"><span class=\"attackProvisions\"></span></div><td colspan=\"6\"><span style=\"float:left\" class=\"icon-bg-black icon-34x34-attack\" tooltip=\"\" tooltip-content=\"{{ 'battle.strentghAttack' | i18n:loc.ale:'battle_calculator' }}\"></span><div class=\"center-34x\"><span class=\"strentghAttack\"></span></div><tr><td colspan=\"2\"><span style=\"float:left\" class=\"icon-bg-black icon-34x34-bashpoints-offensive\" tooltip=\"\" tooltip-content=\"{{ 'battle.attackBashpoint' | i18n:loc.ale:'battle_calculator' }}\"></span><div class=\"center-34x\"><span class=\"attackBashpoint\"></span></div><td colspan=\"6\"><span style=\"float:left\" class=\"icon-bg-red icon-34x34-resource-food\" tooltip=\"\" tooltip-content=\"{{ 'battle.killedprovisions' | i18n:loc.ale:'battle_calculator' }}\"></span><div class=\"center-34x\"><span class=\"attackKilledProvisions\"></span></div><td colspan=\"6\"><span style=\"float:left\" class=\"icon-bg-black icon-34x34-favourite\" tooltip=\"\" tooltip-content=\"{{ 'battle.strongesttype' | i18n:loc.ale:'battle_calculator' }}\"></span><div class=\"center-34x\"><span class=\"strongestTypeOff\"></span></div><tr><td colspan=\"2\"><span style=\"float:left\" class=\"report-symbol icon-34x34-casualties bg-casualties\" tooltip=\"\" tooltip-content=\"{{ 'battle.killrateA' | i18n:loc.ale:'battle_calculator' }}\"></span><div class=\"center-34x\"><span class=\"killrateA\"></span></div><td colspan=\"6\"><span style=\"float:left\" class=\"icon-bg-blue icon-34x34-resource-food\" tooltip=\"\" tooltip-content=\"{{ 'battle.survivedprovisions' | i18n:loc.ale:'battle_calculator' }}\"></span><div class=\"center-34x\"><span class=\"attackSurvivedProvisions\"></span></div><td colspan=\"6\"><span style=\"float:left\" class=\"icon-34x34-skill-attack_bonus\" tooltip=\"\" tooltip-content=\"{{ 'battle.doublestrength' | i18n:loc.ale:'battle_calculator' }}\"></span><div class=\"center-34x\"><span class=\"doubleStrength\"></span></div><tr><th colspan=\"14\">{{ 'battle.defender' | i18n:loc.ale:'battle_calculator' }}<tr><td style=\"padding-left:5px;\"><div style=\"height:34px;line-height:34px;\"><span class=\"unitname\">{{ 'battle.unit' | i18n:loc.ale:'battle_calculator' }}</span></div><div height=\"26px\"><span class=\"icon-20x20-report-amount\"></span><span class=\"unitname\"> {{ 'battle.amount' | i18n:loc.ale:'battle_calculator' }}</span></div><div height=\"26px\"><span class=\"icon-20x20-report-losses\"></span><span class=\"unitname\"> {{ 'battle.loses' | i18n:loc.ale:'battle_calculator' }}</span></div><div height=\"26px\"><span class=\"icon-20x20-report-revive\"></span><span class=\"unitname\"> {{ 'battle.revived' | i18n:loc.ale:'battle_calculator' }}</span></div><div height=\"26px\"><span class=\"unitname\" tooltip=\"\" tooltip-content=\"{{ 'battle.survivorsD' | i18n:loc.ale:'battle_calculator' }}\">{{ 'battle.survivors' | i18n:loc.ale:'battle_calculator' }}</span></div><td><span class=\"icon-bg-black icon-34x34-unit-spear\"></span><div style=\"text-align:center;\"><span id=\"spearD-amount\" class=\"spearD-amount\">0</span></div><div style=\"text-align:center;color:#a1251f\"><span id=\"spearD-losses\" class=\"spearD-losses\">0</span></div><div style=\"text-align:center;color:#009fff\"><span id=\"spearD-revived\" class=\"spearD-revived\">0</span></div><div style=\"text-align:center;color:#000000\"><span id=\"spearD-survived\" class=\"spearD-survived\">0</span></div><td><span class=\"icon-bg-black icon-34x34-unit-sword\"></span><div style=\"text-align:center;\"><span id=\"swordD-amount\" class=\"swordD-amount\">0</span></div><div style=\"text-align:center;color:#a1251f\"><span id=\"swordD-losses\" class=\"swordD-losses\" style=\"text-align:center;color:#a1251f\">0</span></div><div style=\"text-align:center;color:#009fff\"><span id=\"swordD-revived\" class=\"swordD-revived\" style=\"text-align:center;color:#009fff\">0</span></div><div style=\"text-align:center;color:#000000\"><span id=\"swordD-survived\" class=\"swordD-survived\" style=\"text-align:center;color:#000000\">0</span></div><td><span class=\"icon-bg-black icon-34x34-unit-axe\"></span><div style=\"text-align:center;\"><span id=\"axeD-amount\" class=\"axeD-amount\" style=\"text-align:center;\">0</span></div><div style=\"text-align:center;color:#a1251f\"><span id=\"axeD-losses\" class=\"axeD-losses\" style=\"text-align:center;color:#a1251f\">0</span></div><div style=\"text-align:center;color:#009fff\"><span id=\"axeD-revived\" class=\"axeD-revived\" style=\"text-align:center;color:#009fff\">0</span></div><div style=\"text-align:center;color:#000000\"><span id=\"axeD-survived\" class=\"axeD-survived\" style=\"text-align:center;color:#000000\">0</span></div><td><span class=\"icon-bg-black icon-34x34-unit-archer\"></span><div style=\"text-align:center;\"><span id=\"archerD-amount\" class=\"archerD-amount\" style=\"text-align:center;\">0</span></div><div style=\"text-align:center;color:#a1251f\"><span id=\"archerD-losses\" class=\"archerD-losses\" style=\"text-align:center;color:#a1251f\">0</span></div><div style=\"text-align:center;color:#009fff\"><span id=\"archerD-revived\" class=\"archerD-revived\" style=\"text-align:center;color:#009fff\">0</span></div><div style=\"text-align:center;color:#000000\"><span id=\"archerD-survived\" class=\"archerD-survived\" style=\"text-align:center;color:#000000\">0</span></div><td><span class=\"icon-bg-black icon-34x34-unit-light_cavalry\"></span><div style=\"text-align:center;\"><span id=\"lcD-amount\" class=\"lcD-amount\" style=\"text-align:center;\">0</span></div><div style=\"text-align:center;color:#a1251f\"><span id=\"lcD-losses\" class=\"lcD-losses\" style=\"text-align:center;color:#a1251f\">0</span></div><div style=\"text-align:center;color:#009fff\"><span id=\"lcD-revived\" class=\"lcD-revived\" style=\"text-align:center;color:#009fff\">0</span></div><div style=\"text-align:center;color:#000000\"><span id=\"lcD-survived\" class=\"lcD-survived\" style=\"text-align:center;color:#000000\">0</span></div><td><span class=\"icon-bg-black icon-34x34-unit-mounted_archer\"></span><div style=\"text-align:center;\"><span id=\"maD-amount\" class=\"maD-amount\" style=\"text-align:center;\">0</span></div><div style=\"text-align:center;color:#a1251f\"><span id=\"maD-losses\" class=\"maD-losses\" style=\"text-align:center;color:#a1251f\">0</span></div><div style=\"text-align:center;color:#009fff\"><span id=\"maD-revived\" class=\"maD-revived\" style=\"text-align:center;color:#009fff\">0</span></div><div style=\"text-align:center;color:#000000\"><span id=\"maD-survived\" class=\"maD-survived\" style=\"text-align:center;color:#000000\">0</span></div><td><span class=\"icon-bg-black icon-34x34-unit-heavy_cavalry\"></span><div style=\"text-align:center;\"><span id=\"hcD-amount\" class=\"hcD-amount\" style=\"text-align:center;\">0</span></div><div style=\"text-align:center;color:#a1251f\"><span id=\"hcD-losses\" class=\"hcD-losses\" style=\"text-align:center;color:#a1251f\">0</span></div><div style=\"text-align:center;color:#009fff\"><span id=\"hcD-revived\" class=\"hcD-revived\" style=\"text-align:center;color:#009fff\">0</span></div><div style=\"text-align:center;color:#000000\"><span id=\"hcD-survived\" class=\"hcD-survived\" style=\"text-align:center;color:#000000\">0</span></div><td><span class=\"icon-bg-black icon-34x34-unit-ram\"></span><div style=\"text-align:center;\"><span id=\"ramD-amount\" class=\"ramD-amount\" style=\"text-align:center;\">0</span></div><div style=\"text-align:center;color:#a1251f\"><span id=\"ramD-losses\" class=\"ramD-losses\" style=\"text-align:center;color:#a1251f\">0</span></div><div style=\"text-align:center;color:#009fff\"><span id=\"ramD-revived\" class=\"ramD-revived\" style=\"text-align:center;color:#009fff\">0</span></div><div style=\"text-align:center;color:#000000\"><span id=\"ramD-survived\" class=\"ramD-survived\" style=\"text-align:center;color:#000000\">0</span></div><td><span class=\"icon-bg-black icon-34x34-unit-catapult\"></span><div style=\"text-align:center;\"><span id=\"catapultD-amount\" class=\"catapultD-amount\" style=\"text-align:center;\">0</span></div><div style=\"text-align:center;color:#a1251f\"><span id=\"catapultD-losses\" class=\"catapultD-losses\" style=\"text-align:center;color:#a1251f\">0</span></div><div style=\"text-align:center;color:#009fff\"><span id=\"catapultD-revived\" class=\"catapultD-revived\" style=\"text-align:center;color:#009fff\">0</span></div><div style=\"text-align:center;color:#000000\"><span id=\"catapultD-survived\" class=\"catapultD-survived\" style=\"text-align:center;color:#000000\">0</span></div><td><span class=\"icon-bg-black icon-34x34-unit-doppelsoldner\"></span><div style=\"text-align:center;\"><span id=\"berserkerD-amount\" class=\"berserkerD-amount\" style=\"text-align:center;\">0</span></div><div style=\"text-align:center;color:#a1251f\"><span id=\"berserkerD-losses\" class=\"berserkerD-losses\" style=\"text-align:center;color:#a1251f\">0</span></div><div style=\"text-align:center;color:#009fff\"><span id=\"berserkerD-revived\" class=\"berserkerD-revived\" style=\"text-align:center;color:#009fff\">0</span></div><div style=\"text-align:center;color:#000000\"><span id=\"berserkerD-survived\" class=\"berserkerD-survived\" style=\"text-align:center;color:#000000\">0</span></div><td><span class=\"icon-bg-black icon-34x34-unit-trebuchet\"></span><div style=\"text-align:center;\"><span id=\"trebuchetD-amount\" class=\"trebuchetD-amount\" style=\"text-align:center;\">0</span></div><div style=\"text-align:center;color:#a1251f\"><span id=\"trebuchetD-losses\" class=\"trebuchetD-losses\" style=\"text-align:center;color:#a1251f\">0</span></div><div style=\"text-align:center;color:#009fff\"><span id=\"trebuchetD-revived\" class=\"trebuchetD-revived\" style=\"text-align:center;color:#009fff\">0</span></div><div style=\"text-align:center;color:#000000\"><span id=\"trebuchetD-survived\" class=\"trebuchetD-survived\" style=\"text-align:center;color:#000000\">0</span></div><td><span class=\"icon-bg-black icon-34x34-unit-snob\"></span><div style=\"text-align:center;\"><span id=\"snobD-amount\" class=\"snobD-amount\" style=\"text-align:center;\">0</span></div><div style=\"text-align:center;color:#a1251f\"><span id=\"snobD-losses\" class=\"snobD-losses\" style=\"text-align:center;color:#a1251f\">0</span></div><div style=\"text-align:center;color:#009fff\"><span id=\"snobD-revived\" class=\"snobD-revived\" style=\"text-align:center;color:#009fff\">0</span></div><div style=\"text-align:center;color:#000000\"><span id=\"snobD-survived\" class=\"snobD-survived\" style=\"text-align:center;color:#000000\">0</span></div><td><span class=\"icon-bg-black icon-34x34-unit-knight\"></span><div style=\"text-align:center;\"><span id=\"knightD-amount\" class=\"knightD-amount\" style=\"text-align:center;\">0</span></div><div style=\"text-align:center;color:#a1251f\"><span id=\"knightD-losses\" class=\"knightD-losses\" style=\"text-align:center;color:#a1251f\">0</span></div><div style=\"text-align:center;color:#009fff\"><span id=\"knightD-revived\" class=\"knightD-revived\" style=\"text-align:center;color:#009fff\">0</span></div><div style=\"text-align:center;color:#000000\"><span id=\"knightD-survived\" class=\"knightD-survived\" style=\"text-align:center;color:#000000\">0</span></div><tr><td colspan=\"2\"><span style=\"float:left\" class=\"icon-bg-blue icon-34x34-defense\" tooltip=\"\" tooltip-content=\"{{ 'battle.defenceModifier' | i18n:loc.ale:'battle_calculator' }}\"></span><div class=\"center-34x\"><span class=\"defenceModifier\"></span></div><td colspan=\"6\"><span style=\"float:left\" class=\"icon-bg-black icon-34x34-resource-food\" tooltip=\"\" tooltip-content=\"{{ 'battle.provisions' | i18n:loc.ale:'battle_calculator' }}\"></span><div class=\"center-34x\"><span class=\"defenceProvisions\"></span></div><td colspan=\"6\"><span style=\"float:left\" class=\"icon-bg-black icon-34x34-defense\" tooltip=\"\" tooltip-content=\"{{ 'battle.strentghDefend' | i18n:loc.ale:'battle_calculator' }}\"></span><div class=\"center-34x\"><span class=\"strentghDefend\"></span></div><tr><td colspan=\"2\"><span style=\"float:left\" class=\"icon-bg-black icon-34x34-bashpoints-defensive\" tooltip=\"\" tooltip-content=\"{{ 'battle.defenceBashpoint' | i18n:loc.ale:'battle_calculator' }}\"></span><div class=\"center-34x\"><span class=\"defenceBashpoint\"></span></div><td colspan=\"6\"><span style=\"float:left\" class=\"icon-bg-red icon-34x34-resource-food\" tooltip=\"\" tooltip-content=\"{{ 'battle.killedprovisions' | i18n:loc.ale:'battle_calculator' }}\"></span><div class=\"center-34x\"><span class=\"defenceKilledProvisions\"></span></div><td colspan=\"6\"><span style=\"float:left\" class=\"icon-bg-black icon-34x34-favourite\" tooltip=\"\" tooltip-content=\"{{ 'battle.strongesttype' | i18n:loc.ale:'battle_calculator' }}\"></span><div class=\"center-34x\"><span class=\"strongestTypeDef\"></span></div><tr><td colspan=\"2\"><span style=\"float:left\" class=\"report-symbol icon-34x34-casualties bg-casualties\" tooltip=\"\" tooltip-content=\"{{ 'battle.killrateD' | i18n:loc.ale:'battle_calculator' }}\"></span><div class=\"center-34x\"><span class=\"killrateD\"></span></div><td colspan=\"6\"><span style=\"float:left\" class=\"icon-bg-blue icon-34x34-resource-food\" tooltip=\"\" tooltip-content=\"{{ 'battle.survivedprovisions' | i18n:loc.ale:'battle_calculator' }}\"></span><div class=\"center-34x\"><span class=\"defenceSurvivedProvisions\"></span></div><td colspan=\"6\"><span style=\"float:left\" class=\"icon-34x34-skill-better_hospital\" tooltip=\"\" tooltip-content=\"{{ 'battle.beds' | i18n:loc.ale:'battle_calculator' }}\"></span><div class=\"center-34x\"><span class=\"availableBeds\"></span></div><tr id=\"predamage\"><th><span class=\"unitname\">{{ 'battle.predamage' | i18n:loc.ale:'battle_calculator' }}:</span><td colspan=\"13\">{{ 'battle.downgrade' | i18n:loc.ale:'battle_calculator' }}<b class=\"wallfrompre\" id=\"wallfrompre\"></b>{{ 'battle.to' | i18n:loc.ale:'battle_calculator' }}<b class=\"walltopre\" id=\"walltopre\"></b><tr id=\"ramdamage\"><th><span class=\"unitname\">{{ 'battle.damage' | i18n:loc.ale:'battle_calculator' }}:</span><td colspan=\"13\">{{ 'battle.downgrade' | i18n:loc.ale:'battle_calculator' }}<b class=\"wallfrom\" id=\"wallfrom\"></b>{{ 'battle.to' | i18n:loc.ale:'battle_calculator' }}<b class=\"wallto\" id=\"wallto\"></b><tr id=\"catapultdamage\"><th><span class=\"unitname\">{{ 'battle.damageCatapult' | i18n:loc.ale:'battle_calculator' }}:</span><td colspan=\"13\"><span class=\"target\"></span>{{ 'battle.downgradeCatapult' | i18n:loc.ale:'battle_calculator' }}<b class=\"buildingfrom\" id=\"buildingfrom\"> </b>{{ 'battle.to' | i18n:loc.ale:'battle_calculator' }}<b class=\"buildingto\" id=\"buildingto\"></b></table></form><form class=\"addForm1\"><table class=\"tbl-border-light tbl-striped\"><col><col width=\"33%\"><col width=\"33%\"><thead><tr><th colspan=\"3\">{{ 'battle.options' | i18n:loc.ale:'battle_calculator' }}<tbody><tr><td colspan=\"3\" class=\"item-insert\"><span class=\"btn btn-orange addSelected\">{{ 'battle.insert' | i18n:loc.ale:'battle_calculator' }}</span><tr><th><th>{{ 'battle.attacker' | i18n:loc.ale:'battle_calculator' }}<th>{{ 'battle.defender' | i18n:loc.ale:'battle_calculator' }}<tr><td class=\"item-input\"><input class=\"textfield-border\" id=\"village\" value=\"\" autocomplete=\"off\" placeholder=\"{{ 'id' | i18n:loc.ale:'battle_calculator' }}\"><td class=\"item-insertV\"><span class=\"btn btn-orange addSelected\" tooltip=\"\" tooltip-content=\"{{ 'battle.insertV' | i18n:loc.ale:'battle_calculator' }}\">{{ 'battle.insertvillage' | i18n:loc.ale:'battle_calculator' }}</span><td class=\"item-insertVD\"><span class=\"btn btn-orange addSelected\" tooltip=\"\" tooltip-content=\"{{ 'battle.insertVD' | i18n:loc.ale:'battle_calculator' }}\">{{ 'battle.insertvillage' | i18n:loc.ale:'battle_calculator' }}</span><tr><td><span class=\"item-icon\"></span><td class=\"item-name\"><td class=\"item-id\"><tr><td class=\"item-input\"><input class=\"textfield-border\" id=\"preset\" value=\"\" autocomplete=\"off\" placeholder=\"{{ 'name' | i18n:loc.ale:'battle_calculator' }}\"><td class=\"item-insertP\"><span class=\"btn btn-orange addSelected\" tooltip=\"\" tooltip-content=\"{{ 'battle.insertP' | i18n:loc.ale:'battle_calculator' }}\">{{ 'battle.insertpreset' | i18n:loc.ale:'battle_calculator' }}</span><td class=\"item-insertPD\"><span class=\"btn btn-orange addSelected\" tooltip=\"\" tooltip-content=\"{{ 'battle.insertPD' | i18n:loc.ale:'battle_calculator' }}\">{{ 'battle.insertpreset' | i18n:loc.ale:'battle_calculator' }}</span></table></form><form class=\"addForm\"><table class=\"table\" id=\"units\"><col><col width=\"33%\"><col width=\"33%\"><thead><tr><th><th>{{ 'battle.attacker' | i18n:loc.ale:'battle_calculator' }}<th>{{ 'battle.defender' | i18n:loc.ale:'battle_calculator' }}<tbody><tr><td><span class=\"icon-bg-black icon-34x34-unit-spear\"></span><span class=\"unitname\"> {{ 'spear' | i18n:loc.ale:'common' }}</span><td class=\"cell-bottom\"><input class=\"fit textfield-border text-center\" ng-model=\"settings[SETTINGS.BATTLE_SPEAR_A]\"><td class=\"cell-bottom\"><input class=\"fit textfield-border text-center\" ng-model=\"settings[SETTINGS.BATTLE_SPEAR_D]\"><tr><td><span class=\"icon-bg-black icon-34x34-unit-sword\"></span><span class=\"unitname\"> {{ 'sword' | i18n:loc.ale:'common' }}</span><td class=\"cell-bottom\"><input class=\"fit textfield-border text-center\" ng-model=\"settings[SETTINGS.BATTLE_SWORD_A]\"><td class=\"cell-bottom\"><input class=\"fit textfield-border text-center\" ng-model=\"settings[SETTINGS.BATTLE_SWORD_D]\"><tr><td><span class=\"icon-bg-black icon-34x34-unit-axe\"></span><span class=\"unitname\"> {{ 'axe' | i18n:loc.ale:'common' }}</span><td class=\"cell-bottom\"><input class=\"fit textfield-border text-center\" ng-model=\"settings[SETTINGS.BATTLE_AXE_A]\"><td class=\"cell-bottom\"><input class=\"fit textfield-border text-center\" ng-model=\"settings[SETTINGS.BATTLE_AXE_D]\"><tr><td><span class=\"icon-bg-black icon-34x34-unit-archer\"></span><span class=\"unitname\"> {{ 'archer' | i18n:loc.ale:'common' }}</span><td class=\"cell-bottom\"><input class=\"fit textfield-border text-center\" ng-model=\"settings[SETTINGS.BATTLE_ARCHER_A]\"><td class=\"cell-bottom\"><input class=\"fit textfield-border text-center\" ng-model=\"settings[SETTINGS.BATTLE_ARCHER_D]\"><tr><td><span class=\"icon-bg-black icon-34x34-unit-light_cavalry\"></span><span class=\"unitname\"> {{ 'light_cavalry' | i18n:loc.ale:'common' }}</span><td class=\"cell-bottom\"><input class=\"fit textfield-border text-center\" ng-model=\"settings[SETTINGS.BATTLE_LC_A]\"><td class=\"cell-bottom\"><input class=\"fit textfield-border text-center\" ng-model=\"settings[SETTINGS.BATTLE_LC_D]\"><tr><td><span class=\"icon-bg-black icon-34x34-unit-mounted_archer\"></span><span class=\"unitname\"> {{ 'mounted_archer' | i18n:loc.ale:'common' }}</span><td class=\"cell-bottom\"><input class=\"fit textfield-border text-center\" ng-model=\"settings[SETTINGS.BATTLE_MA_A]\"><td class=\"cell-bottom\"><input class=\"fit textfield-border text-center\" ng-model=\"settings[SETTINGS.BATTLE_MA_D]\"><tr><td><span class=\"icon-bg-black icon-34x34-unit-heavy_cavalry\"></span><span class=\"unitname\"> {{ 'heavy_cavalry' | i18n:loc.ale:'common' }}</span><td class=\"cell-bottom\"><input class=\"fit textfield-border text-center\" ng-model=\"settings[SETTINGS.BATTLE_HC_A]\"><td class=\"cell-bottom\"><input class=\"fit textfield-border text-center\" ng-model=\"settings[SETTINGS.BATTLE_HC_D]\"><tr><td><span class=\"icon-bg-black icon-34x34-unit-ram\"></span><span class=\"unitname\"> {{ 'ram' | i18n:loc.ale:'common' }}</span><td class=\"cell-bottom\"><input class=\"fit textfield-border text-center\" ng-model=\"settings[SETTINGS.BATTLE_RAM_A]\"><td class=\"cell-bottom\"><input class=\"fit textfield-border text-center\" ng-model=\"settings[SETTINGS.BATTLE_RAM_D]\"><tr><td><span class=\"icon-bg-black icon-34x34-unit-catapult\"></span><span class=\"unitname\"> {{ 'catapult' | i18n:loc.ale:'common' }}</span><td class=\"cell-bottom\"><input class=\"fit textfield-border text-center\" ng-model=\"settings[SETTINGS.BATTLE_CATAPULT_A]\"><td class=\"cell-bottom\"><input class=\"fit textfield-border text-center\" ng-model=\"settings[SETTINGS.BATTLE_CATAPULT_D]\"><tr><td><span class=\"icon-bg-black icon-34x34-unit-doppelsoldner\"></span><span class=\"unitname\"> {{ 'doppelsoldner' | i18n:loc.ale:'common' }}</span><td class=\"cell-bottom\"><input class=\"fit textfield-border text-center\" ng-model=\"settings[SETTINGS.BATTLE_DOPPELSOLDNER_A]\"><td class=\"cell-bottom\"><input class=\"fit textfield-border text-center\" ng-model=\"settings[SETTINGS.BATTLE_DOPPELSOLDNER_D]\"><tr><td><span class=\"icon-bg-black icon-34x34-unit-trebuchet\"></span><span class=\"unitname\"> {{ 'trebuchet' | i18n:loc.ale:'common' }}</span><td class=\"cell-bottom\"><input class=\"fit textfield-border text-center\" ng-model=\"settings[SETTINGS.BATTLE_TREBUCHET_A]\"><td class=\"cell-bottom\"><input class=\"fit textfield-border text-center\" ng-model=\"settings[SETTINGS.BATTLE_TREBUCHET_D]\"><tr><td><span class=\"icon-bg-black icon-34x34-unit-snob\"></span><span class=\"unitname\"> {{ 'snob' | i18n:loc.ale:'common' }}</span><td class=\"cell-bottom\"><input class=\"fit textfield-border text-center\" ng-model=\"settings[SETTINGS.BATTLE_SNOB_A]\"><td class=\"cell-bottom\"><input class=\"fit textfield-border text-center\" ng-model=\"settings[SETTINGS.BATTLE_SNOB_D]\"><tr><td><span class=\"icon-bg-black icon-34x34-unit-knight\"></span><span class=\"unitname\"> {{ 'knight' | i18n:loc.ale:'common' }}</span><td class=\"cell-bottom\"><input class=\"fit textfield-border text-center\" ng-model=\"settings[SETTINGS.BATTLE_KNIGHT_A]\"><td class=\"cell-bottom\"><input class=\"fit textfield-border text-center\" ng-model=\"settings[SETTINGS.BATTLE_KNIGHT_D]\"></table></form><form class=\"addForm\"><table class=\"table\"><col width=\"34%\"><col width=\"77px\"><col width=\"60px\"><col width=\"77px\"><col width=\"77px\"><col width=\"60px\"><col width=\"77px\"><thead><tr><th colspan=\"7\"><span class=\"icon-bg-black icon-44x44-special\"></span> {{ 'battle.bonuses' | i18n:loc.ale:'battle_calculator' }}<tbody><tr><td><span class=\"icon-bg-black icon-34x34-church\"></span> {{ 'battle.faith' | i18n:loc.ale:'battle_calculator' }}<td colspan=\"3\"><div select=\"\" list=\"church\" selected=\"settings[SETTINGS.BATTLE_CHURCH_A]\" drop-down=\"true\"></div><td colspan=\"3\"><div select=\"\" list=\"church\" selected=\"settings[SETTINGS.BATTLE_CHURCH_D]\" drop-down=\"true\"></div><tr><td><span class=\"icon-bg-black icon-34x34-moral\"></span> {{ 'battle.morale' | i18n:loc.ale:'battle_calculator' }}<td colspan=\"3\" class=\"cell-bottom\"><input class=\"fit textfield-border text-center\" ng-model=\"settings[SETTINGS.BATTLE_MORALE]\"><td colspan=\"3\"><tr><td><span class=\"icon-bg-black icon-34x34-clover\"></span> {{ 'battle.luck' | i18n:loc.ale:'battle_calculator' }}<td colspan=\"3\" class=\"cell-bottom\"><input class=\"fit textfield-border text-center\" ng-model=\"settings[SETTINGS.BATTLE_LUCK]\"><td colspan=\"3\"><tr><td><span class=\"icon-bg-black icon-34x34-building-wall\"></span> {{ 'battle.wall' | i18n:loc.ale:'battle_calculator' }}<td colspan=\"3\"><td colspan=\"3\"><div select=\"\" list=\"wall\" selected=\"settings[SETTINGS.BATTLE_WALL]\" drop-down=\"true\"></div><tr><td><span class=\"icon-bg-black icon-26x26-night-mode\"></span> {{ 'battle.nightbonus' | i18n:loc.ale:'battle_calculator' }}<td colspan=\"3\"><td><td><span class=\"switch\"><div switch-slider=\"\" enabled=\"true\" border=\"true\" value=\"settings[SETTINGS.BATTLE_NIGHT_BONUS]\" vertical=\"false\" size=\"'56x28'\"></div></span><td><tr><td><span class=\"icon-bg-black icon-44x44-premium_officer_leader\"></span> {{ 'battle.leader' | i18n:loc.ale:'battle_calculator' }}<td><td><div class=\"switch\" switch-slider=\"\" enabled=\"true\" border=\"true\" value=\"settings[SETTINGS.BATTLE_OFFICER_LEADER]\" vertical=\"false\" size=\"'56x28'\"></div><td><td colspan=\"3\"><tr><td><span class=\"icon-bg-black icon-44x44-premium_officer_medic\"></span> {{ 'battle.medic' | i18n:loc.ale:'battle_calculator' }}<td><td><div class=\"switch\" switch-slider=\"\" enabled=\"true\" border=\"true\" value=\"settings[SETTINGS.BATTLE_OFFICER_MEDIC]\" vertical=\"false\" size=\"'56x28'\"></div><td><td colspan=\"3\"><tr><td><span class=\"icon-bg-black icon-120x120-skill-medic\"></span> {{ 'battle.doctor' | i18n:loc.ale:'battle_calculator' }}<td><td><div class=\"switch\" switch-slider=\"\" enabled=\"true\" border=\"true\" value=\"settings[SETTINGS.BATTLE_SKILL_MEDIC]\" vertical=\"false\" size=\"'56x28'\"></div><td><td colspan=\"3\"><tr><td><span class=\"icon-bg-black icon-120x120-skill-attack_bonus\"></span> {{ 'battle.attack-bonus' | i18n:loc.ale:'battle_calculator' }}<td colspan=\"3\"><div select=\"\" list=\"weaponmaster\" selected=\"settings[SETTINGS.BATTLE_SKILL_WEAPON_MASTER]\" drop-down=\"true\"></div><td colspan=\"3\"><tr><td><span class=\"icon-bg-black icon-120x120-skill-iron_walls\"></span> {{ 'battle.iron-walls' | i18n:loc.ale:'battle_calculator' }}<td colspan=\"3\"><td colspan=\"3\"><div select=\"\" list=\"ironwalls\" selected=\"settings[SETTINGS.BATTLE_SKILL_IRON_WALLS]\" drop-down=\"true\"></div><tr><td><span class=\"icon-bg-black icon-120x120-skill-better_hospital\"></span> {{ 'battle.clinique' | i18n:loc.ale:'battle_calculator' }}<td colspan=\"3\"><td colspan=\"3\"><div select=\"\" list=\"clinique\" selected=\"settings[SETTINGS.BATTLE_SKILL_CLINIQUE]\" drop-down=\"true\"></div><tr><td><span class=\"icon-bg-black icon-34x34-building-hospital\"></span> {{ 'battle.hospital' | i18n:loc.ale:'battle_calculator' }}<td colspan=\"3\"><td colspan=\"3\"><div select=\"\" list=\"hospital\" selected=\"settings[SETTINGS.BATTLE_HOSPITAL]\" drop-down=\"true\"></div></table></form><form class=\"addForm\"><table class=\"table\"><col><col width=\"33%\"><col width=\"33%\"><thead><tr><th colspan=\"3\"><span class=\"icon-bg-black icon-34x34-paladin\"></span> {{ 'battle.equip' | i18n:loc.ale:'battle_calculator' }}<tbody><tr><th colspan=\"3\">{{ 'battle.defender' | i18n:loc.ale:'battle_calculator' }}<tr><td><div id=\"item\" select=\"\" list=\"knightitem\" selected=\"settings[SETTINGS.BATTLE_KNIGHT_ITEM_D1]\" drop-down=\"true\"></div><td><div id=\"item\" select=\"\" list=\"knightitem\" selected=\"settings[SETTINGS.BATTLE_KNIGHT_ITEM_D2]\" drop-down=\"true\"></div><td><div id=\"item\" select=\"\" list=\"knightitem\" selected=\"settings[SETTINGS.BATTLE_KNIGHT_ITEM_D3]\" drop-down=\"true\"></div><tr><td><div id=\"item\" select=\"\" list=\"itemlevel\" selected=\"settings[SETTINGS.BATTLE_ITEM_LEVEL_D1]\" drop-down=\"true\"></div><td><div id=\"item\" select=\"\" list=\"itemlevel\" selected=\"settings[SETTINGS.BATTLE_ITEM_LEVEL_D2]\" drop-down=\"true\"></div><td><div id=\"item\" select=\"\" list=\"itemlevel\" selected=\"settings[SETTINGS.BATTLE_ITEM_LEVEL_D3]\" drop-down=\"true\"></div><tr><th colspan=\"3\">{{ 'battle.attacker' | i18n:loc.ale:'battle_calculator' }}<tr><td><td><div class=\"item\" select=\"\" list=\"knightitem\" selected=\"settings[SETTINGS.BATTLE_KNIGHT_ITEM_A]\" drop-down=\"true\"></div><td><tr><td><td><div class=\"item\" select=\"\" list=\"itemlevel\" selected=\"settings[SETTINGS.BATTLE_ITEM_LEVEL_A]\" drop-down=\"true\"></div><td></table></form><form class=\"addForm\"><table class=\"table\"><col><col width=\"33%\"><col width=\"33%\"><tr><th colspan=\"3\"><span class=\"icon-34x34-unit-special-ability-catapult\"></span> {{ 'battle.target' | i18n:loc.ale:'battle_calculator' }}<tr><td><td><div select=\"\" list=\"catapulttarget\" selected=\"settings[SETTINGS.BATTLE_CATAPULT_TARGET]\" drop-down=\"true\"></div><td><tr><th colspan=\"3\">{{ 'battle.target-level' | i18n:loc.ale:'battle_calculator' }}<tr><td><td class=\"cell-bottom\"><input class=\"fit textfield-border text-center\" ng-model=\"settings[SETTINGS.BATTLE_TARGET_LEVEL]\"><td></table></form></div><div class=\"rich-text\" ng-show=\"selectedTab === TAB_TYPES.TROOPS\"><h5 class=\"twx-section\">{{ 'troops.header' | i18n:loc.ale:'battle_calculator' }}</h5><form class=\"addForm\"><table class=\"table\"><col width=\"33%\"><col width=\"33%\"><col><thead><tr><th colspan=\"3\">{{ 'troops.th' | i18n:loc.ale:'battle_calculator' }}<tbody><tr><td><span style=\"float:left\" class=\"icon-bg-black icon-34x34-resource-wood\" tooltip=\"\" tooltip-content=\"{{ 'wood' | i18n:loc.ale:'battle_calculator' }}\"></span><div class=\"center-34x\"><span class=\"wood\"></span></div><td><span style=\"float:left\" class=\"icon-bg-black icon-34x34-time-per-tile\" tooltip=\"\" tooltip-content=\"{{ 'speed' | i18n:loc.ale:'battle_calculator' }}\"></span><div class=\"center-34x\"><span class=\"speed\"></span></div><td><span style=\"float:left\" class=\"icon-bg-black icon-34x34-attack\" tooltip=\"\" tooltip-content=\"{{ 'attack' | i18n:loc.ale:'battle_calculator' }}\"></span><div class=\"center-34x\"><span class=\"attack\"></span></div><tr><td><span style=\"float:left\" class=\"icon-bg-black icon-34x34-resource-clay\" tooltip=\"\" tooltip-content=\"{{ 'clay' | i18n:loc.ale:'battle_calculator' }}\"></span><div class=\"center-34x\"><span class=\"clay\"></span></div><td><span style=\"float:left\" class=\"icon-bg-black icon-34x34-units\" tooltip=\"\" tooltip-content=\"{{ 'discipline' | i18n:loc.ale:'battle_calculator' }}\"></span><div class=\"center-34x\"><span class=\"discipline\"></span></div><td><span style=\"float:left\" class=\"icon-bg-black icon-34x34-defense\" tooltip=\"\" tooltip-content=\"{{ 'definf' | i18n:loc.ale:'battle_calculator' }}\"></span><div class=\"center-34x\"><span class=\"definf\"></span></div><tr><td><span style=\"float:left\" class=\"icon-bg-black icon-34x34-resource-iron\" tooltip=\"\" tooltip-content=\"{{ 'iron' | i18n:loc.ale:'battle_calculator' }}\"></span><div class=\"center-34x\"><span class=\"iron\"></span></div><td><span style=\"float:left\" class=\"icon-bg-black icon-34x34-weight\" tooltip=\"\" tooltip-content=\"{{ 'load' | i18n:loc.ale:'battle_calculator' }}\"></span><div class=\"center-34x\"><span class=\"load\"></span></div><td><span style=\"float:left\" class=\"icon-bg-black icon-34x34-defense-cavalry\" tooltip=\"\" tooltip-content=\"{{ 'defcav' | i18n:loc.ale:'battle_calculator' }}\"></span><div class=\"center-34x\"><span class=\"defcav\"></span></div><tr><td><span style=\"float:left\" class=\"icon-bg-black icon-34x34-resource-food\" tooltip=\"\" tooltip-content=\"{{ 'food' | i18n:loc.ale:'battle_calculator' }}\"></span><div class=\"center-34x\"><span class=\"food\"></span></div><td><span style=\"float:left\" class=\"icon-bg-black icon-34x34-time\" tooltip=\"\" tooltip-content=\"{{ 'buildtime' | i18n:loc.ale:'battle_calculator' }}\"></span><div class=\"center-34x\"><span class=\"buildtime\"></span></div><td><span style=\"float:left\" class=\"icon-bg-black icon-34x34-defense-archer\" tooltip=\"\" tooltip-content=\"{{ 'defarc' | i18n:loc.ale:'battle_calculator' }}\"></span><div class=\"center-34x\"><span class=\"defarc\"></span></div><tr><td><span style=\"float:left\" class=\"icon-bg-black icon-34x34-attackinf\" tooltip=\"\" tooltip-content=\"{{ 'attackinf' | i18n:loc.ale:'battle_calculator' }}\"></span><div class=\"center-34x\"><span class=\"attackinf\"></span></div><td><span style=\"float:left\" class=\"icon-bg-black icon-34x34-attackcav\" tooltip=\"\" tooltip-content=\"{{ 'attackcav' | i18n:loc.ale:'battle_calculator' }}\"></span><div class=\"center-34x\"><span class=\"attackcav\"></span></div><td><span style=\"float:left\" class=\"icon-bg-black icon-34x34-attackarc\" tooltip=\"\" tooltip-content=\"{{ 'attackarc' | i18n:loc.ale:'battle_calculator' }}\"></span><div class=\"center-34x\"><span class=\"attackarc\"></span></div></table><br><table class=\"table\" id=\"unitsCost\"><col><col width=\"150px\"><thead><tr><th colspan=\"2\">{{ 'troops.units' | i18n:loc.ale:'battle_calculator' }}<tbody><tr><td><span class=\"icon-bg-black icon-44x44-unit-spear\"></span> {{ 'spear' | i18n:loc.ale:'common' }}<td class=\"cell-bottom\"><input class=\"fit textfield-border text-center\" ng-model=\"settings[SETTINGS.TROOPS_SPEAR]\"><tr><td><span class=\"icon-bg-black icon-44x44-unit-sword\"></span> {{ 'sword' | i18n:loc.ale:'common' }}<td class=\"cell-bottom\"><input class=\"fit textfield-border text-center\" ng-model=\"settings[SETTINGS.TROOPS_SWORD]\"><tr><td><span class=\"icon-bg-black icon-44x44-unit-axe\"></span> {{ 'axe' | i18n:loc.ale:'common' }}<td class=\"cell-bottom\"><input class=\"fit textfield-border text-center\" ng-model=\"settings[SETTINGS.TROOPS_AXE]\"><tr><td><span class=\"icon-bg-black icon-44x44-unit-archer\"></span> {{ 'archer' | i18n:loc.ale:'common' }}<td class=\"cell-bottom\"><input class=\"fit textfield-border text-center\" ng-model=\"settings[SETTINGS.TROOPS_ARCHER]\"><tr><td><span class=\"icon-bg-black icon-44x44-unit-light_cavalry\"></span> {{ 'light_cavalry' | i18n:loc.ale:'common' }}<td class=\"cell-bottom\"><input class=\"fit textfield-border text-center\" ng-model=\"settings[SETTINGS.TROOPS_LC]\"><tr><td><span class=\"icon-bg-black icon-44x44-unit-mounted_archer\"></span> {{ 'mounted_archer' | i18n:loc.ale:'common' }}<td class=\"cell-bottom\"><input class=\"fit textfield-border text-center\" ng-model=\"settings[SETTINGS.TROOPS_MA]\"><tr><td><span class=\"icon-bg-black icon-44x44-unit-heavy_cavalry\"></span> {{ 'heavy_cavalry' | i18n:loc.ale:'common' }}<td class=\"cell-bottom\"><input class=\"fit textfield-border text-center\" ng-model=\"settings[SETTINGS.TROOPS_HC]\"><tr><td><span class=\"icon-bg-black icon-44x44-unit-ram\"></span> {{ 'ram' | i18n:loc.ale:'common' }}<td class=\"cell-bottom\"><input class=\"fit textfield-border text-center\" ng-model=\"settings[SETTINGS.TROOPS_RAM]\"><tr><td><span class=\"icon-bg-black icon-44x44-unit-doppelsoldner\"></span> {{ 'doppelsoldner' | i18n:loc.ale:'common' }}<td class=\"cell-bottom\"><input class=\"fit textfield-border text-center\" ng-model=\"settings[SETTINGS.TROOPS_DOPPELSOLDNER]\"><tr><td><span class=\"icon-bg-black icon-44x44-unit-trebuchet\"></span> {{ 'trebuchet' | i18n:loc.ale:'common' }}<td class=\"cell-bottom\"><input class=\"fit textfield-border text-center\" ng-model=\"settings[SETTINGS.TROOPS_TREBUCHET]\"><tr><td><span class=\"icon-bg-black icon-44x44-unit-snob\"></span> {{ 'snob' | i18n:loc.ale:'common' }}<td class=\"cell-bottom\"><input class=\"fit textfield-border text-center\" ng-model=\"settings[SETTINGS.TROOPS_SNOB]\"><tr><td><span class=\"icon-bg-black icon-44x44-unit-knight\"></span> {{ 'knight' | i18n:loc.ale:'common' }}<td class=\"cell-bottom\"><input class=\"fit textfield-border text-center\" ng-model=\"settings[SETTINGS.TROOPS_KNIGHT]\"><tr><td><span class=\"icon-bg-black icon-44x44-unit-catapult\"></span> {{ 'catapult' | i18n:loc.ale:'common' }}<td class=\"cell-bottom\"><input class=\"fit textfield-border text-center\" ng-model=\"settings[SETTINGS.TROOPS_CATAPULT]\"></table><br><table class=\"table\"><col><col width=\"200px\"><col width=\"60px\"><thead><tr><th colspan=\"3\">{{ 'troops.building' | i18n:loc.ale:'battle_calculator' }}<tbody><tr><td><span class=\"icon-bg-black icon-34x34-building-barracks\"></span> {{ 'troops.barracks' | i18n:loc.ale:'battle_calculator' }}<td><div range-slider=\"\" min=\"settingsMap[SETTINGS.TROOPS_BARRACKS].min\" max=\"settingsMap[SETTINGS.TROOPS_BARRACKS].max\" value=\"settings[SETTINGS.TROOPS_BARRACKS]\" enabled=\"true\"></div><td class=\"cell-bottom\"><input class=\"fit textfield-border text-center\" ng-model=\"settings[SETTINGS.TROOPS_BARRACKS]\"><tr><td><span class=\"icon-bg-black icon-34x34-building-preceptory\"></span> {{ 'troops.preceptory' | i18n:loc.ale:'battle_calculator' }}<td><div range-slider=\"\" min=\"settingsMap[SETTINGS.TROOPS_PRECEPTORY].min\" max=\"settingsMap[SETTINGS.TROOPS_PRECEPTORY].max\" value=\"settings[SETTINGS.TROOPS_PRECEPTORY]\" enabled=\"true\"></div><td class=\"cell-bottom\"><input class=\"fit textfield-border text-center\" ng-model=\"settings[SETTINGS.TROOPS_PRECEPTORY]\"></table><table class=\"table\"><col><col width=\"140px\"><col width=\"60px\"><thead><tr><th colspan=\"3\">{{ 'troops.effects' | i18n:loc.ale:'battle_calculator' }}<tbody><tr><td colspan=\"2\"><span class=\"icon-bg-black icon-120x120-domination\"></span> {{ 'troops.domination' | i18n:loc.ale:'battle_calculator' }}<td><div switch-slider=\"\" enabled=\"true\" border=\"true\" value=\"settings[SETTINGS.TROOPS_DOMINATION]\" vertical=\"false\" size=\"'56x28'\"></div><tr><td><span class=\"icon-bg-black icon-120x120-skill-recruit_speed_bonus\"></span> {{ 'troops.training' | i18n:loc.ale:'battle_calculator' }}<td colspan=\"2\"><div select=\"\" list=\"training\" selected=\"settings[SETTINGS.TROOPS_TRAINING]\" drop-down=\"true\"></div><tr><td><span class=\"icon-bg-black icon-34x34-building-preceptory\"></span> {{ 'troops.order' | i18n:loc.ale:'battle_calculator' }}<td colspan=\"2\"><div select=\"\" list=\"order\" selected=\"settings[SETTINGS.TROOPS_ORDER]\" drop-down=\"true\"></div></table></form></div><div class=\"rich-text\" ng-show=\"selectedTab === TAB_TYPES.BASHPOINTS\"><h5 class=\"twx-section\">{{ 'bashpoints.header' | i18n:loc.ale:'battle_calculator' }}</h5><form class=\"addForm\"><table class=\"table\"><col width=\"50%\"><col width=\"50%\"><thead><tr><th colspan=\"2\">{{ 'bashpoints.th' | i18n:loc.ale:'battle_calculator' }}<tbody><tr><td><span class=\"icon-bg-black icon-34x34-attack\"></span> {{ 'bashpoints.attacker' | i18n:loc.ale:'battle_calculator' }}<td class=\"points-att\"><tr><td><span class=\"icon-bg-black icon-34x34-defense\"></span> {{ 'bashpoints.defender' | i18n:loc.ale:'battle_calculator' }}<td class=\"points-def\"></table><br><table class=\"table\" id=\"unitsBash\"><col><col width=\"150px\"><thead><tr><th colspan=\"2\">{{ 'bashpoints.killed' | i18n:loc.ale:'battle_calculator' }}<tbody><tr><td><span class=\"icon-bg-black icon-44x44-unit-spear\"></span> {{ 'spear' | i18n:loc.ale:'common' }}<td class=\"cell-bottom\"><input class=\"fit textfield-border text-center\" ng-model=\"settings[SETTINGS.BASHPOINTS_SPEAR]\"><tr><td><span class=\"icon-bg-black icon-44x44-unit-sword\"></span> {{ 'sword' | i18n:loc.ale:'common' }}<td class=\"cell-bottom\"><input class=\"fit textfield-border text-center\" ng-model=\"settings[SETTINGS.BASHPOINTS_SWORD]\"><tr><td><span class=\"icon-bg-black icon-44x44-unit-axe\"></span> {{ 'axe' | i18n:loc.ale:'common' }}<td class=\"cell-bottom\"><input class=\"fit textfield-border text-center\" ng-model=\"settings[SETTINGS.BASHPOINTS_AXE]\"><tr><td><span class=\"icon-bg-black icon-44x44-unit-archer\"></span> {{ 'archer' | i18n:loc.ale:'common' }}<td class=\"cell-bottom\"><input class=\"fit textfield-border text-center\" ng-model=\"settings[SETTINGS.BASHPOINTS_ARCHER]\"><tr><td><span class=\"icon-bg-black icon-44x44-unit-light_cavalry\"></span> {{ 'light_cavalry' | i18n:loc.ale:'common' }}<td class=\"cell-bottom\"><input class=\"fit textfield-border text-center\" ng-model=\"settings[SETTINGS.BASHPOINTS_LC]\"><tr><td><span class=\"icon-bg-black icon-44x44-unit-mounted_archer\"></span> {{ 'mounted_archer' | i18n:loc.ale:'common' }}<td class=\"cell-bottom\"><input class=\"fit textfield-border text-center\" ng-model=\"settings[SETTINGS.BASHPOINTS_MA]\"><tr><td><span class=\"icon-bg-black icon-44x44-unit-heavy_cavalry\"></span> {{ 'heavy_cavalry' | i18n:loc.ale:'common' }}<td class=\"cell-bottom\"><input class=\"fit textfield-border text-center\" ng-model=\"settings[SETTINGS.BASHPOINTS_HC]\"><tr><td><span class=\"icon-bg-black icon-44x44-unit-ram\"></span> {{ 'ram' | i18n:loc.ale:'common' }}<td class=\"cell-bottom\"><input class=\"fit textfield-border text-center\" ng-model=\"settings[SETTINGS.BASHPOINTS_RAM]\"><tr><td><span class=\"icon-bg-black icon-44x44-unit-doppelsoldner\"></span> {{ 'doppelsoldner' | i18n:loc.ale:'common' }}<td class=\"cell-bottom\"><input class=\"fit textfield-border text-center\" ng-model=\"settings[SETTINGS.BASHPOINTS_DOPPELSOLDNER]\"><tr><td><span class=\"icon-bg-black icon-44x44-unit-trebuchet\"></span> {{ 'trebuchet' | i18n:loc.ale:'common' }}<td class=\"cell-bottom\"><input class=\"fit textfield-border text-center\" ng-model=\"settings[SETTINGS.BASHPOINTS_TREBUCHET]\"><tr><td><span class=\"icon-bg-black icon-44x44-unit-snob\"></span> {{ 'snob' | i18n:loc.ale:'common' }}<td class=\"cell-bottom\"><input class=\"fit textfield-border text-center\" ng-model=\"settings[SETTINGS.BASHPOINTS_SNOB]\"><tr><td><span class=\"icon-bg-black icon-44x44-unit-knight\"></span> {{ 'knight' | i18n:loc.ale:'common' }}<td class=\"cell-bottom\"><input class=\"fit textfield-border text-center\" ng-model=\"settings[SETTINGS.BASHPOINTS_KNIGHT]\"><tr><td><span class=\"icon-bg-black icon-44x44-unit-catapult\"></span> {{ 'catapult' | i18n:loc.ale:'common' }}<td class=\"cell-bottom\"><input class=\"fit textfield-border text-center\" ng-model=\"settings[SETTINGS.BASHPOINTS_CATAPULT]\"></table></form></div></div></div></div><footer class=\"win-foot\"><ul class=\"list-btn list-center\"><li ng-show=\"selectedTab === TAB_TYPES.BATTLE\"><a href=\"#\" class=\"btn-border btn-red\" ng-click=\"simulate()\">{{ 'simulate.btn' | i18n:loc.ale:'battle_calculator' }}</a><li ng-show=\"selectedTab === TAB_TYPES.TROOPS\"><a href=\"#\" class=\"btn-border btn-orange\" ng-click=\"calculateT()\">{{ 'check.btn' | i18n:loc.ale:'battle_calculator' }}</a><li ng-show=\"selectedTab === TAB_TYPES.BASHPOINTS\"><a href=\"#\" class=\"btn-border btn-orange\" ng-click=\"calculateB()\">{{ 'check.btn' | i18n:loc.ale:'battle_calculator' }}</a></ul></footer></div>`)
        interfaceOverflow.addStyle('#two-battle-calculator div[select]{float:right}#two-battle-calculator div[select] .select-handler{line-height:28px}#two-battle-calculator .range-container{width:250px}#two-battle-calculator .textfield-border{width:219px;height:34px;margin-bottom:2px;padding-top:2px}#two-battle-calculator .textfield-border.fit{width:100%}#two-battle-calculator .addForm1 td{text-align:center}#two-battle-calculator .addForm1 th{text-align:center;padding:0px}#two-battle-calculator .addForm1 span{height:26px;line-height:26px;padding:0 10px}#two-battle-calculator .addForm1 input{height:34px;line-height:26px;color:#000;font-size:14px;background:url(data:image/png;base64,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) top left #b89064;box-shadow:inset 0 0 0 1px #000,inset 0 0 0 2px #a2682c,inset 0 0 0 3px #000,inset -3px -3px 2px 0 #fff,inset 0 0 9px 5px rgba(99,54,0,0.5);text-align:center;width:213px}#two-battle-calculator .addForm .table{border-spacing:1px;border-collapse:separate;box-shadow:0 0 0 2px rgba(124,54,0,0.4);width:100%;background:url(data:image/png;base64,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) #d1ad86}#two-battle-calculator .addForm .table th{background:url(data:image/png;base64,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);text-align:center;min-height:26px;line-height:26px;color:#fff3d0;font-size:14px;font-weight:normal;padding-left:5px;border:1px solid rgba(124,54,0,0.3);padding:1px}#two-battle-calculator .addForm .table td{border:1px solid rgba(124,54,0,0.3);padding:1px}#two-battle-calculator .addForm .table tr nth-child(odd) td{background:url(data:image/png;base64,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) #d1ad86}#two-battle-calculator .addForm .table_vertical td:nth-child(odd){background:url(data:image/png;base64,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) #d1ad86}#two-battle-calculator .addForm .center-34x{text-align:center;line-height:34px}#two-battle-calculator .addForm span{text-align:right}#two-battle-calculator .icon-120x120-skill-recruit_speed_bonus{zoom:.283333}#two-battle-calculator .icon-120x120-skill-recruit_speed_bonus:before{-moz-transform:scale(.283333)}#two-battle-calculator .icon-120x120-domination{zoom:.283333}#two-battle-calculator .icon-120x120-domination:before{-moz-transform:scale(.283333)}#two-battle-calculator .icon-26x26-night-mode{zoom:1.307692}#two-battle-calculator .icon-26x26-night-mode:before{-moz-transform:scale(1.307692)}#two-battle-calculator .icon-120x120-skill-medic{zoom:.283333}#two-battle-calculator .icon-120x120-skill-medic:before{-moz-transform:scale(.283333)}#two-battle-calculator .icon-120x120-skill-attack_bonus{zoom:.283333}#two-battle-calculator .icon-120x120-skill-attack_bonus:before{-moz-transform:scale(.283333)}#two-battle-calculator .icon-120x120-skill-iron_walls{zoom:.283333}#two-battle-calculator .icon-120x120-skill-iron_walls:before{-moz-transform:scale(.283333)}#two-battle-calculator .icon-120x120-skill-better_hospital{zoom:.283333}#two-battle-calculator .icon-120x120-skill-better_hospital:before{-moz-transform:scale(.283333)}#two-battle-calculator .icon-44x44-premium_officer_leader{zoom:.772727}#two-battle-calculator .icon-44x44-premium_officer_leader:before{-moz-transform:scale(.772727)}#two-battle-calculator .icon-44x44-premium_officer_medic{zoom:.772727}#two-battle-calculator .icon-44x44-premium_officer_medic:before{-moz-transform:scale(.772727)}#two-battle-calculator .icon-90x90-item-spear{background-image:url(https://twxen.innogamescdn.com/img/icons/no-alpha_3bfedc2e90.jpg);background-position:-1710px -1892px;zoom:.288888}#two-battle-calculator .icon-90x90-item-spear:before{-moz-transform:scale(.288888)}#two-battle-calculator .icon-90x90-item-sword:before{background-image:url(https://twxen.innogamescdn.com/img/icons/no-alpha_3bfedc2e90.jpg);background-position:-1620px -1892px;transform:scale(.288888);width:26px;height:26px}#two-battle-calculator .icon-34x34-attackarc:before{background-image:url(https://i.imgur.com/qGoj36r.png);background-position:0px 0px}#two-battle-calculator .icon-34x34-attackcav:before{background-image:url(https://i.imgur.com/etSiYUW.png);background-position:0px 0px}#two-battle-calculator .icon-34x34-attackinf:before{background-image:url(https://i.imgur.com/z9hX6Au.png);background-position:0px 0px}#two-battle-calculator .icon-90x90-item-axe{zoom:.288888}#two-battle-calculator .icon-90x90-item-axe:before{-moz-transform:scale(.288888)}#two-battle-calculator .icon-90x90-item-archer{zoom:.288888}#two-battle-calculator .icon-90x90-item-archer:before{-moz-transform:scale(.288888)}#two-battle-calculator .icon-90x90-item-light_cavalry{zoom:.288888}#two-battle-calculator .icon-90x90-item-light_cavalry:before{-moz-transform:scale(.288888)}#two-battle-calculator .icon-90x90-item-mounted_archer{zoom:.288888}#two-battle-calculator .icon-90x90-item-mounted_archer:before{-moz-transform:scale(.288888)}#two-battle-calculator .icon-90x90-item-heavy_cavalry{zoom:.288888}#two-battle-calculator .icon-90x90-item-heavy_cavalry:before{-moz-transform:scale(.288888)}#two-battle-calculator .icon-90x90-item-ram{zoom:.288888}#two-battle-calculator .icon-90x90-item-ram:before{-moz-transform:scale(.288888)}#two-battle-calculator .icon-90x90-item-catapult{zoom:.288888}#two-battle-calculator .icon-90x90-item-catapult:before{-moz-transform:scale(.288888)}#two-battle-calculator .icon-90x90-item-snob{zoom:.288888}#two-battle-calculator .icon-90x90-item-snob:before{-moz-transform:scale(.288888)}#two-battle-calculator .icon-34x34-paladin{zoom:.73529412}#two-battle-calculator .icon-34x34-paladin:before{-moz-transform:scale(.73529412)}#two-battle-calculator .icon-34x34-unit-special-ability-catapult{zoom:.73529412}#two-battle-calculator .icon-34x34-unit-special-ability-catapult:before{-moz-transform:scale(.73529412)}#two-battle-calculator .icon-44x44-special{zoom:.772727}#two-battle-calculator .icon-44x44-special:before{-moz-transform:scale(.772727)}#two-battle-calculator .switch{text-align:center}#two-battle-calculator .item{text-align:center}')
    }

    const buildWindow = function () {
        $scope = $rootScope.$new()
        $scope.SETTINGS = SETTINGS
        $scope.TAB_TYPES = TAB_TYPES
        $scope.running = battleCalculator.isRunning()
        $scope.selectedTab = TAB_TYPES.BATTLE
        $scope.settingsMap = SETTINGS_MAP
		
        $scope.catapulttarget = Settings.encodeList(B_CAT_TARGET, {
            textObject: 'battle_calculator',
            disabled: true
        })
		
        $scope.knightitem = Settings.encodeList(B_ITEMS, {
            textObject: 'battle_calculator',
            disabled: true
        })
		
        $scope.itemlevel = Settings.encodeList(B_ITEMS_LEVELS, {
            textObject: 'battle_calculator',
            disabled: true
        })
		
        $scope.order = Settings.encodeList(T_ORDER_TYPE, {
            textObject: 'battle_calculator',
            disabled: true
        })
        $scope.wall = Settings.encodeList(B_WALLS, {
            textObject: 'battle_calculator',
            disabled: true
        })
        $scope.church = Settings.encodeList(B_CHURCHES, {
            textObject: 'battle_calculator',
            disabled: true
        })
        $scope.weaponmaster = Settings.encodeList(B_SKILL_WEAPON_MASTER_LEVEL, {
            textObject: 'battle_calculator',
            disabled: true
        })
        $scope.ironwalls = Settings.encodeList(B_SKILL_IRON_WALLS_LEVEL, {
            textObject: 'battle_calculator',
            disabled: true
        })
        $scope.clinique = Settings.encodeList(B_SKILL_CLINIQUE_LEVEL, {
            textObject: 'battle_calculator',
            disabled: true
        })
        $scope.hospital = Settings.encodeList(B_HOSPITAL_LEVEL, {
            textObject: 'battle_calculator',
            disabled: true
        })
        $scope.training = Settings.encodeList(T_TRAINING_LEVEL, {
            textObject: 'battle_calculator',
            disabled: true
        })

        settings.injectScope($scope)

        $scope.selectTab = selectTab
        $scope.saveSettings = saveSettings
        $scope.switchState = switchState

        let eventScope = new EventScope('twoverflow_battle_calculator_window', function onDestroy () {
            console.log('battleCalculator window closed')
        })
        eventScope.register(eventTypeProvider.BATTLE_CALCULATOR_START, eventHandlers.start)
        eventScope.register(eventTypeProvider.BATTLE_CALCULATOR_STOP, eventHandlers.stop)
        
        windowManagerService.getScreenWithInjectedScope('!twoverflow_battle_calculator_window', $scope)
    }

    return init
})

define('two/battleCalculator/settings', [], function () {
    return {
        BATTLE_SPEAR_D: 'battle_spear_d',
        BATTLE_SWORD_D: 'battle_sword_d',
        BATTLE_AXE_D: 'battle_axe_d',
        BATTLE_ARCHER_D: 'battle_archer_d',
        BATTLE_LC_D: 'battle_lc_d',
        BATTLE_MA_D: 'battle_ma_d',
        BATTLE_HC_D: 'battle_hc_d',
        BATTLE_RAM_D: 'battle_ram_d',
        BATTLE_CATAPULT_D: 'battle_catapult_d',
        BATTLE_DOPPELSOLDNER_D: 'battle_doppelsoldner_d',
        BATTLE_TREBUCHET_D: 'battle_trebuchet_d',
        BATTLE_SNOB_D: 'battle_snob_d',
        BATTLE_KNIGHT_D: 'battle_knight_d',
        BATTLE_SPEAR_A: 'battle_spear_a',
        BATTLE_SWORD_A: 'battle_sword_a',
        BATTLE_AXE_A: 'battle_axe_a',
        BATTLE_ARCHER_A: 'battle_archer_a',
        BATTLE_LC_A: 'battle_lc_a',
        BATTLE_MA_A: 'battle_ma_a',
        BATTLE_HC_A: 'battle_hc_a',
        BATTLE_RAM_A: 'battle_ram_a',
        BATTLE_CATAPULT_A: 'battle_catapult_a',
        BATTLE_DOPPELSOLDNER_A: 'battle_doppelsoldner_a',
        BATTLE_TREBUCHET_A: 'battle_trebuchet_a',
        BATTLE_SNOB_A: 'battle_snob_a',
        BATTLE_KNIGHT_A: 'battle_knight_a',
        BATTLE_CHURCH_A: 'battle_church_a',
        BATTLE_KNIGHT_ITEM_D1: 'battle_knight_item_d1',
        BATTLE_KNIGHT_ITEM_D2: 'battle_knight_item_d2',
        BATTLE_KNIGHT_ITEM_D3: 'battle_knight_item_d3',
        BATTLE_KNIGHT_ITEM_A: 'battle_knight_item_a',
        BATTLE_ITEM_LEVEL_D1: 'battle_item_level_d1',
        BATTLE_ITEM_LEVEL_D2: 'battle_item_level_d2',
        BATTLE_ITEM_LEVEL_D3: 'battle_item_level_d3',
        BATTLE_ITEM_LEVEL_A: 'battle_item_level_a',
        BATTLE_CATAPULT_TARGET: 'battle_catapult_target',
        BATTLE_TARGET_LEVEL: 'battle_target_level',
        BATTLE_CHURCH_D: 'battle_church_d',
        BATTLE_MORALE: 'battle_morale',
        BATTLE_LUCK: 'battle_luck',
        BATTLE_WALL: 'battle_wall',
        BATTLE_NIGHT_BONUS: 'battle_night_bonus',
        BATTLE_OFFICER_LEADER: 'battle_officer_leader',
        BATTLE_OFFICER_MEDIC: 'battle_officer_medic',
        BATTLE_SKILL_MEDIC: 'battle_skill_medic',
        BATTLE_SKILL_WEAPON_MASTER: 'battle_skill_weapon_master',
        BATTLE_SKILL_IRON_WALLS: 'battle_skill_iron_walls',
        BATTLE_SKILL_CLINIQUE: 'battle_skill_clinique',
        BATTLE_HOSPITAL: 'battle_hospital',
        TROOPS_BARRACKS: 'troops_barracks',
        TROOPS_PRECEPTORY: 'troops_preceptory',
        TROOPS_ORDER: 'troops_order',
        TROOPS_DOMINATION: 'troops_domination',
        TROOPS_TRAINING: 'troops_training',
        TROOPS_SPEAR: 'troops_spear',
        TROOPS_SWORD: 'troops_sword',
        TROOPS_AXE: 'troops_axe',
        TROOPS_ARCHER: 'troops_archer',
        TROOPS_LC: 'troops_lc',
        TROOPS_MA: 'troops_ma',
        TROOPS_HC: 'troops_hc',
        TROOPS_RAM: 'troops_ram',
        TROOPS_CATAPULT: 'troops_catapult',
        TROOPS_KNIGHT: 'troops_knight',
        TROOPS_SNOB: 'troops_snob',
        TROOPS_DOPPELSOLDNER: 'troops_doppelsoldner',
        TROOPS_TREBUCHET: 'troops_trebuchet',
        BASHPOINTS_SPEAR: 'bashpoints_spear',
        BASHPOINTS_SWORD: 'bashpoints_sword',
        BASHPOINTS_AXE: 'bashpoints_axe',
        BASHPOINTS_ARCHER: 'bashpoints_archer',
        BASHPOINTS_LC: 'bashpoints_lc',
        BASHPOINTS_MA: 'bashpoints_ma',
        BASHPOINTS_HC: 'bashpoints_hc',
        BASHPOINTS_RAM: 'bashpoints_ram',
        BASHPOINTS_CATAPULT: 'bashpoints_catapult',
        BASHPOINTS_KNIGHT: 'bashpoints_knight',
        BASHPOINTS_SNOB: 'bashpoints_snob',
        BASHPOINTS_DOPPELSOLDNER: 'bashpoints_doppelsoldner',
        BASHPOINTS_TREBUCHET: 'bashpoints_trebuchet'
    }
})

define('two/battleCalculator/settings/updates', function () {
    return {
    }
})

define('two/battleCalculator/settings/map', [
    'two/battleCalculator/settings'
], function (
    SETTINGS
) {
    return {
        [SETTINGS.BATTLE_CATAPULT_TARGET]: {
            default: false,
            disabledOption: true,
            inputType: 'select'
        },
        [SETTINGS.BATTLE_ITEM_LEVEL_D1]: {
            default: false,
            disabledOption: true,
            inputType: 'select'
        },
        [SETTINGS.BATTLE_ITEM_LEVEL_D2]: {
            default: false,
            disabledOption: true,
            inputType: 'select'
        },
        [SETTINGS.BATTLE_ITEM_LEVEL_D3]: {
            default: false,
            disabledOption: true,
            inputType: 'select'
        },
        [SETTINGS.BATTLE_ITEM_LEVEL_A]: {
            default: false,
            disabledOption: true,
            inputType: 'select'
        },
        [SETTINGS.BATTLE_KNIGHT_ITEM_D1]: {
            default: false,
            disabledOption: true,
            inputType: 'select'
        },
        [SETTINGS.BATTLE_KNIGHT_ITEM_D2]: {
            default: false,
            disabledOption: true,
            inputType: 'select'
        },
        [SETTINGS.BATTLE_KNIGHT_ITEM_D3]: {
            default: false,
            disabledOption: true,
            inputType: 'select'
        },
        [SETTINGS.BATTLE_KNIGHT_ITEM_A]: {
            default: false,
            disabledOption: true,
            inputType: 'select'
        },
        [SETTINGS.BATTLE_CHURCH_A]: {
            default: '1',
            inputType: 'select'
        },
        [SETTINGS.BATTLE_CHURCH_D]: {
            default: '1',
            inputType: 'select'
        },
        [SETTINGS.BATTLE_WALL]: {
            default: '20',
            inputType: 'select'
        },
        [SETTINGS.BATTLE_NIGHT_BONUS]: {
            default: false,
            inputType: 'checkbox'
        },
        [SETTINGS.BATTLE_OFFICER_LEADER]: {
            default: false,
            inputType: 'checkbox'
        },
        [SETTINGS.BATTLE_OFFICER_MEDIC]: {
            default: false,
            inputType: 'checkbox'
        },
        [SETTINGS.BATTLE_SKILL_MEDIC]: {
            default: false,
            inputType: 'checkbox'
        },
        [SETTINGS.BATTLE_SKILL_WEAPON_MASTER]: {
            default: false,
            disabledOption: true,
            inputType: 'select'
        },
        [SETTINGS.BATTLE_SKILL_IRON_WALLS]: {
            default: false,
            disabledOption: true,
            inputType: 'select'
        },
        [SETTINGS.BATTLE_SKILL_CLINIQUE]: {
            default: false,
            disabledOption: true,
            inputType: 'select'
        },
        [SETTINGS.BATTLE_HOSPITAL]: {
            default: false,
            disabledOption: true,
            inputType: 'select'
        },
        [SETTINGS.TROOPS_BARRACKS]: {
            default: 25,
            inputType: 'number',
            min: 1,
            max: 25
        },
        [SETTINGS.TROOPS_PRECEPTORY]: {
            default: 10,
            inputType: 'number',
            min: 0,
            max: 10
        },
        [SETTINGS.TROOPS_ORDER]: {
            default: false,
            disabledOption: true,
            inputType: 'select'
        },
        [SETTINGS.TROOPS_DOMINATION]: {
            default: false,
            inputType: 'checkbox'
        },
        [SETTINGS.TROOPS_TRAINING]: {
            default: false,
            disabledOption: true,
            inputType: 'select'
        }
    }
})
define('two/battleCalculator/types/item', [], function () {
    return {
        HALBERD_OF_GUAN_YU: 'battle.halberd',
        PARACELSUS_LONGSWORD: 'battle.longsword',
        THORGARDS_BATTLE_AXE: 'battle.battleaxe',
        NIMRODS_LONGBOW: 'battle.longbow',
        MIESZKOS_LANCE: 'battle.lance',
        NIMRODS_COMPOSITE_BOW: 'battle.compositebow',
        BAPTISTES_BANNER: 'battle.banner',
        CAROLS_MORNING_STAR: 'battle.star',
        ALETHEIAS_BONFIRE: 'battle.bonfire',
        VASCOS_SCEPTER: 'battle.scepter'
    }
})

define('two/battleCalculator/types/level', [], function () {
    return {
        LEVEL_1: 'level_1',
        LEVEL_2: 'level_2',
        LEVEL_3: 'level_3'
    }
})

define('two/battleCalculator/types/catapult-target', [], function () {
    return {
        HEADQUARTER: 'headquarter',
        WAREHOUSE: 'warehouse',
        FARM: 'farm',
        RALLY_POINT: 'rally_point',
        STATUE: 'statue',
        WALL: 'wall',
        TAVERN: 'tavern',
        BARRACKS: 'barracks',
        PRECEPTORY: 'preceptory',
        HOSPITAL: 'hospital',
        CLAY_PIT: 'clay_pit',
        IRON_MINE: 'iron_mine',
        TIMBER_CAMP: 'timber_camp',
        CHAPEL: 'chapel',
        CHURCH: 'church',
        MARKET: 'market',
        ACADEMY: 'academy'
    }
})

define('two/battleCalculator/types/order', [], function () {
    return {
        TEUTONIC_ORDER: 'troops.teutonic',
        TEMPLAR_ORDER: 'troops.templars'
    }
})

define('two/battleCalculator/types/church', [], function () {
    return {
        NO_CHURCH: 'without',
        LEVEL_1: 'level_1',
        LEVEL_2: 'level_2',
        LEVEL_3: 'level_3'
    }
})

define('two/battleCalculator/types/wall', [], function () {
    return {
        NO_WALL: 'without',
        LEVEL_1: 'level_1',
        LEVEL_2: 'level_2',
        LEVEL_3: 'level_3',
        LEVEL_4: 'level_4',
        LEVEL_5: 'level_5',
        LEVEL_6: 'level_6',
        LEVEL_7: 'level_7',
        LEVEL_8: 'level_8',
        LEVEL_9: 'level_9',
        LEVEL_10: 'level_10',
        LEVEL_11: 'level_11',
        LEVEL_12: 'level_12',
        LEVEL_13: 'level_13',
        LEVEL_14: 'level_14',
        LEVEL_15: 'level_15',
        LEVEL_16: 'level_16',
        LEVEL_17: 'level_17',
        LEVEL_18: 'level_18',
        LEVEL_19: 'level_19',
        LEVEL_20: 'level_20'
    }
})

define('two/battleCalculator/types/weapon-master', [], function () {
    return {
        LEVEL_1: 'level_1',
        LEVEL_2: 'level_2',
        LEVEL_3: 'level_3',
        LEVEL_4: 'level_4',
        LEVEL_5: 'level_5'
    }
})

define('two/battleCalculator/types/iron-walls', [], function () {
    return {
        LEVEL_1: 'level_1',
        LEVEL_2: 'level_2',
        LEVEL_3: 'level_3',
        LEVEL_4: 'level_4',
        LEVEL_5: 'level_5'
    }
})

define('two/battleCalculator/types/clinique', [], function () {
    return {
        LEVEL_1: 'level_1',
        LEVEL_2: 'level_2',
        LEVEL_3: 'level_3',
        LEVEL_4: 'level_4',
        LEVEL_5: 'level_5',
        LEVEL_6: 'level_6',
        LEVEL_7: 'level_7',
        LEVEL_8: 'level_8',
        LEVEL_9: 'level_9',
        LEVEL_10: 'level_10'
    }
})

define('two/battleCalculator/types/hospital', [], function () {
    return {
        LEVEL_1: 'level_1',
        LEVEL_2: 'level_2',
        LEVEL_3: 'level_3',
        LEVEL_4: 'level_4',
        LEVEL_5: 'level_5',
        LEVEL_6: 'level_6',
        LEVEL_7: 'level_7',
        LEVEL_8: 'level_8',
        LEVEL_9: 'level_9',
        LEVEL_10: 'level_10'
    }
})

define('two/battleCalculator/types/training', [], function () {
    return {
        LEVEL_1: 'level_1',
        LEVEL_2: 'level_2',
        LEVEL_3: 'level_3',
        LEVEL_4: 'level_4',
        LEVEL_5: 'level_5'
    }
})
require([
    'two/ready',
    'two/battleCalculator',
    'two/battleCalculator/ui',
    'two/battleCalculator/events'
], function (
    ready,
    battleCalculator,
    battleCalculatorInterface
) {
    if (battleCalculator.isInitialized()) {
        return false
    }

    ready(function () {
        battleCalculator.init()
        battleCalculatorInterface()
    }, ['map', 'world_config'])
})

define('two/builderQueue', [
    'two/ready',
    'two/utils',
    'two/Settings',
    'two/builderQueue/settings',
    'two/builderQueue/settings/map',
    'two/builderQueue/settings/updates',
    'two/builderQueue/sequenceStatus',
    'conf/upgradeabilityStates',
    'conf/buildingTypes',
    'conf/locationTypes',
    'queues/EventQueue',
    'Lockr',
    'helper/time'
], function (
    ready,
    utils,
    Settings,
    SETTINGS,
    SETTINGS_MAP,
    UPDATES,
    SEQUENCE_STATUS,
    UPGRADEABILITY_STATES,
    BUILDING_TYPES,
    LOCATION_TYPES,
    eventQueue,
    Lockr,
    timeHelper
) {
    let buildingService = injector.get('buildingService')
    let premiumActionService = injector.get('premiumActionService')
    let buildingQueueService = injector.get('buildingQueueService')
    let initialized = false
    let running = false
    let intervalCheckId
    let intervalInstantCheckId
    let buildingSequenceLimit
    const ANALYSES_PER_MINUTE = 1
    const ANALYSES_PER_MINUTE_INSTANT_FINISH = 10
    const VILLAGE_BUILDINGS = {}
    const LOGS_LIMIT = 500
    let groupList
    let $player
    let logs
    let sequencesAvail = true
    let settings
    let builderSettings
    const STORAGE_KEYS = {
        LOGS: 'builder_queue_log',
        SETTINGS: 'builder_queue_settings'
    }

    /**
     * Loop all player villages, check if ready and init the building analyse
     * for each village.
     */
    const analyseVillages = function () {
        const villageIds = getVillageIds()

        if (!sequencesAvail) {
            builderQueue.stop()
            return false
        }

        villageIds.forEach(function (villageId) {
            const village = $player.getVillage(villageId)
            const readyState = village.checkReadyState()
            const queue = village.buildingQueue
            const jobs = queue.getAmountJobs()

            if (jobs === queue.getUnlockedSlots()) {
                return false
            }

            if (!readyState.buildingQueue || !readyState.buildings) {
                return false
            }

            analyseVillageBuildings(village)
        })
    }

    const analyseVillagesInstantFinish = function () {
        const villageIds = getVillageIds()

        villageIds.forEach(function (villageId) {
            const village = $player.getVillage(villageId)
            const queue = village.buildingQueue

            if (queue.getAmountJobs()) {
                const jobs = queue.getQueue()

                jobs.forEach(function (job) {
                    if (buildingQueueService.canBeFinishedForFree(job, village)) {
                        premiumActionService.instantBuild(job, LOCATION_TYPES.MASS_SCREEN, true, villageId)
                    }
                })
            }
        })
    }

    const initializeAllVillages = function () {
        const villageIds = getVillageIds()

        villageIds.forEach(function (villageId) {
            const village = $player.getVillage(villageId)

            if (!village.isInitialized()) {
                villageService.initializeVillage(village)
            }
        })
    }

    /**
     * Generate an Array with all player's village IDs.
     *
     * @return {Array}
     */
    const getVillageIds = function () {
        const groupVillages = builderSettings[SETTINGS.GROUP_VILLAGES]
        let villages = []

        if (groupVillages) {
            villages = groupList.getGroupVillageIds(groupVillages)
            villages = villages.filter(function (vid) {
                return $player.getVillage(vid)
            })
        } else {
            utils.each($player.getVillages(), function (village) {
                villages.push(village.getId())
            })
        }

        return villages
    }

    /**
     * Loop all village buildings, start build job if available.
     *
     * @param {VillageModel} village
     */
    const analyseVillageBuildings = function (village) {
        let buildingLevels = angular.copy(village.buildingData.getBuildingLevels())
        const currentQueue = village.buildingQueue.getQueue()
        let sequence = angular.copy(VILLAGE_BUILDINGS)
        const sequences = builderSettings[SETTINGS.BUILDING_SEQUENCES]
        const activeSequenceId = builderSettings[SETTINGS.ACTIVE_SEQUENCE]
        const activeSequence = sequences[activeSequenceId]

        currentQueue.forEach(function (job) {
            buildingLevels[job.building]++
        })

        if (checkVillageBuildingLimit(buildingLevels)) {
            return false
        }

        activeSequence.some(function (buildingName) {
            if (++sequence[buildingName] > buildingLevels[buildingName]) {
                buildingService.compute(village)

                checkAndUpgradeBuilding(village, buildingName, function (jobAdded, data) {
                    if (jobAdded && data.job) {
                        eventQueue.trigger(eventTypeProvider.BUILDER_QUEUE_JOB_STARTED, data.job)
                        addLog(village.getId(), data.job)
                    }
                })

                return true
            }
        })
    }

    /**
     * Init a build job
     *
     * @param {VillageModel} village
     * @param {String} buildingName - Building to be build.
     * @param {Function} callback
     */
    const checkAndUpgradeBuilding = function (village, buildingName, callback) {
        const upgradeability = checkBuildingUpgradeability(village, buildingName)

        if (upgradeability === UPGRADEABILITY_STATES.POSSIBLE) {
            upgradeBuilding(village, buildingName, function (data) {
                callback(true, data)
            })
        } else if (upgradeability === UPGRADEABILITY_STATES.NOT_ENOUGH_FOOD) {
            if (builderSettings[SETTINGS.PRIORIZE_FARM]) {
                const limitFarm = buildingSequenceLimit[BUILDING_TYPES.FARM]
                const villageFarm = village.getBuildingData().getDataForBuilding(BUILDING_TYPES.FARM)

                if (villageFarm.level < limitFarm) {
                    upgradeBuilding(village, BUILDING_TYPES.FARM, function (data) {
                        callback(true, data)
                    })
                }
            }
        }

        callback(false)
    }

    const upgradeBuilding = function (village, buildingName, callback) {
        socketService.emit(routeProvider.VILLAGE_UPGRADE_BUILDING, {
            building: buildingName,
            village_id: village.getId(),
            location: LOCATION_TYPES.MASS_SCREEN,
            premium: false
        }, callback)
    }

    /**
     * Can't just use the .upgradeability value because of the preserve resources setting.
     */
    const checkBuildingUpgradeability = function (village, buildingName) {
        const buildingData = village.getBuildingData().getDataForBuilding(buildingName)

        if (buildingData.upgradeability === UPGRADEABILITY_STATES.POSSIBLE) {
            const nextLevelCosts = buildingData.nextLevelCosts
            const resources = village.getResources().getComputed()

            if (
                resources.clay.currentStock - builderSettings[SETTINGS.PRESERVE_CLAY] < nextLevelCosts.clay ||
                resources.iron.currentStock - builderSettings[SETTINGS.PRESERVE_IRON] < nextLevelCosts.iron ||
                resources.wood.currentStock - builderSettings[SETTINGS.PRESERVE_WOOD] < nextLevelCosts.wood
            ) {
                return UPGRADEABILITY_STATES.NOT_ENOUGH_RESOURCES
            }
        }

        return buildingData.upgradeability
    }

    /**
     * Check if all buildings from the sequence already reached
     * the specified level.
     *
     * @param {Object} buildingLevels - Current buildings level from the village.
     * @return {Boolean} True if the levels already reached the limit.
     */
    const checkVillageBuildingLimit = function (buildingLevels) {
        for (let buildingName in buildingLevels) {
            if (buildingLevels[buildingName] < buildingSequenceLimit[buildingName]) {
                return false
            }
        }

        return true
    }

    /**
     * Check if the building sequence is valid by analysing if the
     * buildings exceed the maximum level.
     *
     * @param {Array} sequence
     * @return {Boolean}
     */
    const validSequence = function (sequence) {
        const buildingData = modelDataService.getGameData().getBuildings()

        for (let i = 0; i < sequence.length; i++) {
            let building = sequence[i]

            if (++sequence[building] > buildingData[building].max_level) {
                return false
            }
        }

        return true
    }

    /**
     * Get the level max for each building.
     *
     * @param {String} sequenceId
     * @return {Object} Maximum level for each building.
     */
    const getSequenceLimit = function (sequenceId) {
        const sequences = builderSettings[SETTINGS.BUILDING_SEQUENCES]
        const sequence = sequences[sequenceId]
        let sequenceLimit = angular.copy(VILLAGE_BUILDINGS)

        sequence.forEach(function (buildingName) {
            sequenceLimit[buildingName]++
        })

        return sequenceLimit
    }

    const addLog = function (villageId, jobData) {
        let data = {
            time: timeHelper.gameTime(),
            villageId: villageId,
            building: jobData.building,
            level: jobData.level
        }

        logs.unshift(data)

        if (logs.length > LOGS_LIMIT) {
            logs.splice(logs.length - LOGS_LIMIT, logs.length)
        }

        Lockr.set(STORAGE_KEYS.LOGS, logs)

        return true
    }

    let builderQueue = {}

    builderQueue.start = function () {
        if (!sequencesAvail) {
            eventQueue.trigger(eventTypeProvider.BUILDER_QUEUE_NO_SEQUENCES)
            return false
        }

        running = true
        intervalCheckId = setInterval(analyseVillages, 60000 / ANALYSES_PER_MINUTE)
        intervalInstantCheckId = setInterval(analyseVillagesInstantFinish, 60000 / ANALYSES_PER_MINUTE_INSTANT_FINISH)
        
        ready(function () {
            initializeAllVillages()
            analyseVillages()
            analyseVillagesInstantFinish()
        }, ['all_villages_ready'])

        eventQueue.trigger(eventTypeProvider.BUILDER_QUEUE_START)
    }

    builderQueue.stop = function () {
        running = false
        clearInterval(intervalCheckId)
        clearInterval(intervalInstantCheckId)
        eventQueue.trigger(eventTypeProvider.BUILDER_QUEUE_STOP)
    }

    builderQueue.isRunning = function () {
        return running
    }

    builderQueue.isInitialized = function () {
        return initialized
    }

    builderQueue.getSettings = function () {
        return settings
    }

    builderQueue.getLogs = function () {
        return logs
    }

    builderQueue.clearLogs = function () {
        logs = []
        Lockr.set(STORAGE_KEYS.LOGS, logs)
        eventQueue.trigger(eventTypeProvider.BUILDER_QUEUE_CLEAR_LOGS)
    }

    builderQueue.addBuildingSequence = function (id, sequence) {
        let sequences = builderSettings[SETTINGS.BUILDING_SEQUENCES]

        if (id in sequences) {
            return SEQUENCE_STATUS.SEQUENCE_EXISTS
        }

        if (!Array.isArray(sequence)) {
            return SEQUENCE_STATUS.SEQUENCE_INVALID
        }

        sequences[id] = sequence
        settings.set(SETTINGS.BUILDING_SEQUENCES, sequences, {
            quiet: true
        })
        eventQueue.trigger(eventTypeProvider.BUILDER_QUEUE_BUILDING_SEQUENCES_ADDED, id)

        return SEQUENCE_STATUS.SEQUENCE_SAVED
    }

    builderQueue.updateBuildingSequence = function (id, sequence) {
        let sequences = builderSettings[SETTINGS.BUILDING_SEQUENCES]

        if (!(id in sequences)) {
            return SEQUENCE_STATUS.SEQUENCE_NO_EXISTS
        }

        if (!Array.isArray(sequence) || !validSequence(sequence)) {
            return SEQUENCE_STATUS.SEQUENCE_INVALID
        }

        sequences[id] = sequence
        settings.set(SETTINGS.BUILDING_SEQUENCES, sequences, {
            quiet: true
        })
        eventQueue.trigger(eventTypeProvider.BUILDER_QUEUE_BUILDING_SEQUENCES_UPDATED, id)

        return SEQUENCE_STATUS.SEQUENCE_SAVED
    }

    builderQueue.removeSequence = function (id) {
        let sequences = builderSettings[SETTINGS.BUILDING_SEQUENCES]

        if (!(id in sequences)) {
            return SEQUENCE_STATUS.SEQUENCE_NO_EXISTS
        }

        delete sequences[id]
        settings.set(SETTINGS.BUILDING_SEQUENCES, sequences, {
            quiet: true
        })
        eventQueue.trigger(eventTypeProvider.BUILDER_QUEUE_BUILDING_SEQUENCES_REMOVED, id)
    }

    builderQueue.init = function () {
        initialized = true
        logs = Lockr.get(STORAGE_KEYS.LOGS, [], true)
        $player = modelDataService.getSelectedCharacter()
        groupList = modelDataService.getGroupList()
        
        settings = new Settings({
            settingsMap: SETTINGS_MAP,
            storageKey: STORAGE_KEYS.SETTINGS
        })

        settings.onChange(function (changes, updates, opt) {
            builderSettings = settings.getAll()

            if (running) {
                if (updates[UPDATES.ANALYSE]) {
                    analyseVillages()
                }
            }

            if (!opt.quiet) {
                eventQueue.trigger(eventTypeProvider.BUILDER_QUEUE_SETTINGS_CHANGE)
            }
        })

        builderSettings = settings.getAll()

        for (let buildingName in BUILDING_TYPES) {
            VILLAGE_BUILDINGS[BUILDING_TYPES[buildingName]] = 0
        }

        sequencesAvail = Object.keys(builderSettings[SETTINGS.BUILDING_SEQUENCES]).length
        buildingSequenceLimit = sequencesAvail ? getSequenceLimit(builderSettings[SETTINGS.ACTIVE_SEQUENCE]) : false

        $rootScope.$on(eventTypeProvider.BUILDING_LEVEL_CHANGED, function (event, data) {
            if (!running) {
                return false
            }

            setTimeout(function () {
                let village = $player.getVillage(data.village_id)
                analyseVillageBuildings(village)
            }, 1000)
        })
    }

    return builderQueue
})

define('two/builderQueue/defaultOrders', [
    'conf/buildingTypes'
], function (
    BUILDING_TYPES
) {
    let defaultSequences = {}
    
    const shuffle = function (array) {
        array.sort(() => Math.random() - 0.5)
    }

    const parseSequence = function (rawSequence) {
        let parsed = []

        for (let i = 0; i < rawSequence.length; i++) {
            let item = rawSequence[i]

            if (Array.isArray(item)) {
                shuffle(item)
                parsed = parsed.concat(item)
            } else {
                parsed.push(item)
            }
        }

        return parsed
    }

    const parseSequences = function (rawSequences) {
        let parsed = {}

        for (let i in rawSequences) {
            if (hasOwn.call(rawSequences, i)) {
                parsed[i] = parseSequence(rawSequences[i])
            }
        }

        return parsed
    }

    defaultSequences['Essential'] = [
        BUILDING_TYPES.HEADQUARTER, // 1
        BUILDING_TYPES.FARM, // 1
        BUILDING_TYPES.WAREHOUSE, // 1
        BUILDING_TYPES.RALLY_POINT, // 1
        BUILDING_TYPES.BARRACKS, // 1
        [
            // Quest: The Resources
            BUILDING_TYPES.TIMBER_CAMP, // 1
            BUILDING_TYPES.TIMBER_CAMP, // 2
            BUILDING_TYPES.CLAY_PIT, // 1
            BUILDING_TYPES.IRON_MINE, // 1

            BUILDING_TYPES.HEADQUARTER, // 2
            BUILDING_TYPES.RALLY_POINT, // 2
        ],
        [
            // Quest: First Steps
            BUILDING_TYPES.FARM, // 2
            BUILDING_TYPES.WAREHOUSE, // 2
            
            // Quest: Laying Down Foundation
            BUILDING_TYPES.CLAY_PIT, // 2
            BUILDING_TYPES.IRON_MINE, // 2
        ],
        [
            // Quest: More Resources
            BUILDING_TYPES.TIMBER_CAMP, // 3
            BUILDING_TYPES.CLAY_PIT, // 3
            BUILDING_TYPES.IRON_MINE, // 3
            
            // Quest: Resource Building
            BUILDING_TYPES.WAREHOUSE, // 3
            BUILDING_TYPES.TIMBER_CAMP, // 4
            BUILDING_TYPES.CLAY_PIT, // 4
            BUILDING_TYPES.IRON_MINE, // 4
        ],
        [
            // Quest: Get an Overview
            BUILDING_TYPES.WAREHOUSE, // 4
            BUILDING_TYPES.TIMBER_CAMP, // 5
            BUILDING_TYPES.CLAY_PIT, // 5
            BUILDING_TYPES.IRON_MINE, // 5

            // Quest: Capital
            BUILDING_TYPES.FARM, // 3
            BUILDING_TYPES.WAREHOUSE, // 5
            BUILDING_TYPES.HEADQUARTER, // 3
        ],
        [
            // Quest: The Hero
            BUILDING_TYPES.STATUE, // 1

            // Quest: Resource Expansions
            BUILDING_TYPES.TIMBER_CAMP, // 6
            BUILDING_TYPES.CLAY_PIT, // 6
            BUILDING_TYPES.IRON_MINE, // 6
        ],
        [
            // Quest: Military
            BUILDING_TYPES.BARRACKS, // 2

            // Quest: The Hospital
            BUILDING_TYPES.HOSPITAL, // 1
            BUILDING_TYPES.HEADQUARTER, // 4
            BUILDING_TYPES.TIMBER_CAMP, // 7
            BUILDING_TYPES.CLAY_PIT, // 7
            BUILDING_TYPES.IRON_MINE, // 7
            BUILDING_TYPES.FARM, // 4
        ],
        [
            // Quest: Resources
            BUILDING_TYPES.TIMBER_CAMP, // 8
            BUILDING_TYPES.CLAY_PIT, // 8
            BUILDING_TYPES.IRON_MINE, // 8
        ],
        // Quest: The Wall
        BUILDING_TYPES.WAREHOUSE, // 6
        BUILDING_TYPES.HEADQUARTER, // 5
        BUILDING_TYPES.WALL, // 1
        [
            // Quest: Village Improvements
            BUILDING_TYPES.TIMBER_CAMP, // 9
            BUILDING_TYPES.CLAY_PIT, // 9
            BUILDING_TYPES.IRON_MINE, // 9
            BUILDING_TYPES.TIMBER_CAMP, // 10
            BUILDING_TYPES.CLAY_PIT, // 10
            BUILDING_TYPES.IRON_MINE, // 10
            BUILDING_TYPES.FARM, // 5
        ],
        BUILDING_TYPES.FARM, // 6
        BUILDING_TYPES.FARM, // 7
        [
            // Quest: Hard work
            BUILDING_TYPES.TIMBER_CAMP, // 11
            BUILDING_TYPES.CLAY_PIT, // 11
            BUILDING_TYPES.IRON_MINE, // 11
            BUILDING_TYPES.TIMBER_CAMP, // 12
            BUILDING_TYPES.CLAY_PIT, // 12
            BUILDING_TYPES.IRON_MINE, // 12
        ],
        [
            // Quest: The way of defence
            BUILDING_TYPES.BARRACKS, // 3

            BUILDING_TYPES.WAREHOUSE, // 7
            BUILDING_TYPES.WAREHOUSE, // 8
            BUILDING_TYPES.FARM, // 8
            BUILDING_TYPES.WAREHOUSE, // 9
            BUILDING_TYPES.WAREHOUSE, // 10
        ],
        [
            // Quest: Market Barker
            BUILDING_TYPES.HEADQUARTER, // 6
            BUILDING_TYPES.MARKET, // 1

            // Quest: Preparations
            BUILDING_TYPES.BARRACKS, // 4
            BUILDING_TYPES.WALL, // 2
            BUILDING_TYPES.WALL, // 3
        ],
        [
            BUILDING_TYPES.FARM, // 9
            BUILDING_TYPES.FARM, // 10

            BUILDING_TYPES.BARRACKS, // 5
            BUILDING_TYPES.WAREHOUSE, // 11
            BUILDING_TYPES.FARM, // 11
        ],
        [
            BUILDING_TYPES.BARRACKS, // 6
            BUILDING_TYPES.WAREHOUSE, // 12
            BUILDING_TYPES.FARM, // 12

            BUILDING_TYPES.BARRACKS, // 7
            BUILDING_TYPES.WAREHOUSE, // 13
            BUILDING_TYPES.FARM, // 13
        ],
        [
            BUILDING_TYPES.WALL, // 4
            BUILDING_TYPES.WALL, // 5
            BUILDING_TYPES.WALL, // 6

            BUILDING_TYPES.MARKET, // 2
            BUILDING_TYPES.MARKET, // 3
            BUILDING_TYPES.MARKET, // 4
        ],
        [
            BUILDING_TYPES.BARRACKS, // 8
            BUILDING_TYPES.BARRACKS, // 9

            BUILDING_TYPES.HEADQUARTER, // 7
            BUILDING_TYPES.HEADQUARTER, // 8
        ],
        [
            BUILDING_TYPES.TAVERN, // 1
            BUILDING_TYPES.TAVERN, // 2
            BUILDING_TYPES.TAVERN, // 3

            BUILDING_TYPES.RALLY_POINT, // 3
        ],
        [
            BUILDING_TYPES.BARRACKS, // 10
            BUILDING_TYPES.BARRACKS, // 11

            BUILDING_TYPES.WAREHOUSE, // 14
            BUILDING_TYPES.FARM, // 14
        ],
        [
            BUILDING_TYPES.WAREHOUSE, // 15
            BUILDING_TYPES.FARM, // 15

            BUILDING_TYPES.BARRACKS, // 12
            BUILDING_TYPES.BARRACKS, // 13
        ],
        [
            BUILDING_TYPES.STATUE, // 2
            BUILDING_TYPES.STATUE, // 3

            BUILDING_TYPES.WALL, // 7
            BUILDING_TYPES.WALL, // 8
        ],
        [
            BUILDING_TYPES.HEADQUARTER, // 9
            BUILDING_TYPES.HEADQUARTER, // 10

            BUILDING_TYPES.WAREHOUSE, // 16
            BUILDING_TYPES.FARM, // 16
            BUILDING_TYPES.FARM, // 17
        ],
        [
            BUILDING_TYPES.IRON_MINE, // 13
            BUILDING_TYPES.IRON_MINE, // 14
            BUILDING_TYPES.IRON_MINE, // 15

            BUILDING_TYPES.WAREHOUSE, // 17
        ],
        [
            BUILDING_TYPES.BARRACKS, // 14
            BUILDING_TYPES.BARRACKS, // 15

            BUILDING_TYPES.WAREHOUSE, // 18
            BUILDING_TYPES.FARM, // 18
        ],
        [
            BUILDING_TYPES.WALL, // 9
            BUILDING_TYPES.WALL, // 10

            BUILDING_TYPES.TAVERN, // 4
            BUILDING_TYPES.TAVERN, // 5
            BUILDING_TYPES.TAVERN, // 6
        ],
        [
            BUILDING_TYPES.MARKET, // 5
            BUILDING_TYPES.MARKET, // 6
            BUILDING_TYPES.MARKET, // 7

            BUILDING_TYPES.WAREHOUSE, // 19
            BUILDING_TYPES.FARM, // 19
            BUILDING_TYPES.WAREHOUSE, // 20
            BUILDING_TYPES.FARM, // 20
            BUILDING_TYPES.WAREHOUSE, // 21
            BUILDING_TYPES.FARM, // 21
        ],
        [
            BUILDING_TYPES.IRON_MINE, // 16
            BUILDING_TYPES.IRON_MINE, // 17
            BUILDING_TYPES.IRON_MINE, // 18

            BUILDING_TYPES.RALLY_POINT, // 4
        ],
        [
            BUILDING_TYPES.BARRACKS, // 16
            BUILDING_TYPES.BARRACKS, // 17

            BUILDING_TYPES.FARM, // 22
            BUILDING_TYPES.FARM, // 23
            BUILDING_TYPES.FARM, // 24
            BUILDING_TYPES.FARM, // 25
        ],
        [
            BUILDING_TYPES.WAREHOUSE, // 22
            BUILDING_TYPES.WAREHOUSE, // 23

            BUILDING_TYPES.HEADQUARTER, // 11
            BUILDING_TYPES.HEADQUARTER, // 12
        ],
        [
            BUILDING_TYPES.STATUE, // 4
            BUILDING_TYPES.STATUE, // 5

            BUILDING_TYPES.FARM, // 26
            BUILDING_TYPES.BARRACKS, // 18
        ],
        [
            BUILDING_TYPES.HEADQUARTER, // 14
            BUILDING_TYPES.HEADQUARTER, // 15

            BUILDING_TYPES.FARM, // 27
            BUILDING_TYPES.BARRACKS, // 19
        ],
        [
            BUILDING_TYPES.HEADQUARTER, // 15
            BUILDING_TYPES.HEADQUARTER, // 16

            BUILDING_TYPES.BARRACKS, // 20

            BUILDING_TYPES.HEADQUARTER, // 17
            BUILDING_TYPES.HEADQUARTER, // 18
            BUILDING_TYPES.HEADQUARTER, // 19
            BUILDING_TYPES.HEADQUARTER, // 20
        ],
        [
            BUILDING_TYPES.ACADEMY, // 1

            BUILDING_TYPES.FARM, // 28
            BUILDING_TYPES.WAREHOUSE, // 23
            BUILDING_TYPES.WAREHOUSE, // 24
            BUILDING_TYPES.WAREHOUSE, // 25
        ],
        [
            BUILDING_TYPES.MARKET, // 8
            BUILDING_TYPES.MARKET, // 9
            BUILDING_TYPES.MARKET, // 10

            BUILDING_TYPES.TIMBER_CAMP, // 13
            BUILDING_TYPES.CLAY_PIT, // 13
            BUILDING_TYPES.IRON_MINE, // 19
        ],
        [
            BUILDING_TYPES.TIMBER_CAMP, // 14
            BUILDING_TYPES.CLAY_PIT, // 14
            BUILDING_TYPES.TIMBER_CAMP, // 15
            BUILDING_TYPES.CLAY_PIT, // 15

            BUILDING_TYPES.TIMBER_CAMP, // 16
            BUILDING_TYPES.TIMBER_CAMP, // 17
        ],
        [
            BUILDING_TYPES.WALL, // 11
            BUILDING_TYPES.WALL, // 12

            BUILDING_TYPES.MARKET, // 11
            BUILDING_TYPES.MARKET, // 12
            BUILDING_TYPES.MARKET, // 13
        ],
        [
            BUILDING_TYPES.TIMBER_CAMP, // 18
            BUILDING_TYPES.CLAY_PIT, // 16
            BUILDING_TYPES.TIMBER_CAMP, // 19
            BUILDING_TYPES.CLAY_PIT, // 17

            BUILDING_TYPES.TAVERN, // 7
            BUILDING_TYPES.TAVERN, // 8
            BUILDING_TYPES.TAVERN, // 9
        ],
        [
            BUILDING_TYPES.WALL, // 13
            BUILDING_TYPES.WALL, // 14

            BUILDING_TYPES.TIMBER_CAMP, // 20
            BUILDING_TYPES.CLAY_PIT, // 18
            BUILDING_TYPES.IRON_MINE, // 20
        ],
        [
            BUILDING_TYPES.TIMBER_CAMP, // 21
            BUILDING_TYPES.CLAY_PIT, // 19
            BUILDING_TYPES.IRON_MINE, // 21

            BUILDING_TYPES.BARRACKS, // 21
            BUILDING_TYPES.BARRACKS, // 22
            BUILDING_TYPES.BARRACKS, // 23
        ],
        [
            BUILDING_TYPES.FARM, // 29
            BUILDING_TYPES.WAREHOUSE, // 26
            BUILDING_TYPES.WAREHOUSE, // 27

            BUILDING_TYPES.TAVERN, // 10
            BUILDING_TYPES.TAVERN, // 11
            BUILDING_TYPES.TAVERN, // 12
        ],
        [
            BUILDING_TYPES.TIMBER_CAMP, // 22
            BUILDING_TYPES.CLAY_PIT, // 20
            BUILDING_TYPES.IRON_MINE, // 22

            BUILDING_TYPES.TIMBER_CAMP, // 23
            BUILDING_TYPES.CLAY_PIT, // 21
            BUILDING_TYPES.IRON_MINE, // 23
        ],
        [
            BUILDING_TYPES.TIMBER_CAMP, // 24
            BUILDING_TYPES.CLAY_PIT, // 22
            BUILDING_TYPES.IRON_MINE, // 24

            BUILDING_TYPES.BARRACKS, // 24
            BUILDING_TYPES.BARRACKS, // 25
        ],
        [
            BUILDING_TYPES.FARM, // 30
            BUILDING_TYPES.WAREHOUSE, // 28
            BUILDING_TYPES.WAREHOUSE, // 29

            BUILDING_TYPES.WALL, // 15
            BUILDING_TYPES.WALL, // 16
            BUILDING_TYPES.WALL, // 17
            BUILDING_TYPES.WALL, // 18
        ],
        [
            BUILDING_TYPES.TAVERN, // 13
            BUILDING_TYPES.TAVERN, // 14

            BUILDING_TYPES.RALLY_POINT, // 5

            BUILDING_TYPES.TIMBER_CAMP, // 25
            BUILDING_TYPES.CLAY_PIT, // 23
            BUILDING_TYPES.IRON_MINE, // 25
        ],
        [
            BUILDING_TYPES.TIMBER_CAMP, // 26
            BUILDING_TYPES.CLAY_PIT, // 24
            BUILDING_TYPES.IRON_MINE, // 26

            BUILDING_TYPES.TIMBER_CAMP, // 27
            BUILDING_TYPES.CLAY_PIT, // 25
            BUILDING_TYPES.IRON_MINE, // 27
        ],
        [
            BUILDING_TYPES.TIMBER_CAMP, // 28
            BUILDING_TYPES.CLAY_PIT, // 26
            BUILDING_TYPES.IRON_MINE, // 28

            BUILDING_TYPES.TIMBER_CAMP, // 29
            BUILDING_TYPES.CLAY_PIT, // 27
            BUILDING_TYPES.CLAY_PIT, // 28
            BUILDING_TYPES.IRON_MINE, // 29
        ],
        [
            BUILDING_TYPES.TIMBER_CAMP, // 30
            BUILDING_TYPES.CLAY_PIT, // 29
            BUILDING_TYPES.CLAY_PIT, // 30
            BUILDING_TYPES.IRON_MINE, // 30

            BUILDING_TYPES.WALL, // 19
            BUILDING_TYPES.WALL, // 20
        ]
    ]

    defaultSequences['Full Village'] = [
        [
            BUILDING_TYPES.HOSPITAL, // 2
            BUILDING_TYPES.HOSPITAL, // 3
            BUILDING_TYPES.HOSPITAL, // 4
            BUILDING_TYPES.HOSPITAL, // 5

            BUILDING_TYPES.MARKET, // 14
            BUILDING_TYPES.MARKET, // 15
            BUILDING_TYPES.MARKET, // 16
            BUILDING_TYPES.MARKET, // 17
        ],
        [
            BUILDING_TYPES.HEADQUARTER, // 21
            BUILDING_TYPES.HEADQUARTER, // 22
            BUILDING_TYPES.HEADQUARTER, // 23
            BUILDING_TYPES.HEADQUARTER, // 24
            BUILDING_TYPES.HEADQUARTER, // 25

            BUILDING_TYPES.PRECEPTORY, // 1

            BUILDING_TYPES.HOSPITAL, // 6
            BUILDING_TYPES.HOSPITAL, // 7
            BUILDING_TYPES.HOSPITAL, // 8
            BUILDING_TYPES.HOSPITAL, // 9
            BUILDING_TYPES.HOSPITAL, // 10
        ],
        [
            BUILDING_TYPES.MARKET, // 18
            BUILDING_TYPES.MARKET, // 19
            BUILDING_TYPES.MARKET, // 20
            BUILDING_TYPES.MARKET, // 21

            BUILDING_TYPES.PRECEPTORY, // 2
            BUILDING_TYPES.PRECEPTORY, // 3

            BUILDING_TYPES.MARKET, // 22
            BUILDING_TYPES.MARKET, // 23
            BUILDING_TYPES.MARKET, // 24
            BUILDING_TYPES.MARKET, // 25
        ],
        [
            BUILDING_TYPES.HEADQUARTER, // 26
            BUILDING_TYPES.HEADQUARTER, // 27
            BUILDING_TYPES.HEADQUARTER, // 28
            BUILDING_TYPES.HEADQUARTER, // 29
            BUILDING_TYPES.HEADQUARTER, // 30

            BUILDING_TYPES.PRECEPTORY, // 4
            BUILDING_TYPES.PRECEPTORY, // 5
            BUILDING_TYPES.PRECEPTORY, // 6
            BUILDING_TYPES.PRECEPTORY, // 7
            BUILDING_TYPES.PRECEPTORY, // 8
            BUILDING_TYPES.PRECEPTORY, // 9
            BUILDING_TYPES.PRECEPTORY, // 10
        ]
    ]

    Array.prototype.unshift.apply(
        defaultSequences['Full Village'],
        defaultSequences['Essential']
    )

    defaultSequences['Essential Without Wall'] =
        defaultSequences['Essential'].filter(function (building) {
            return building !== BUILDING_TYPES.WALL
        })

    defaultSequences['Full Wall'] = [
        BUILDING_TYPES.WALL,
        BUILDING_TYPES.WALL,
        BUILDING_TYPES.WALL,
        BUILDING_TYPES.WALL,
        BUILDING_TYPES.WALL,
        BUILDING_TYPES.WALL,
        BUILDING_TYPES.WALL,
        BUILDING_TYPES.WALL,
        BUILDING_TYPES.WALL,
        BUILDING_TYPES.WALL,
        BUILDING_TYPES.WALL,
        BUILDING_TYPES.WALL,
        BUILDING_TYPES.WALL,
        BUILDING_TYPES.WALL,
        BUILDING_TYPES.WALL,
        BUILDING_TYPES.WALL,
        BUILDING_TYPES.WALL,
        BUILDING_TYPES.WALL,
        BUILDING_TYPES.WALL,
        BUILDING_TYPES.WALL // 20
    ]

    defaultSequences['Full Farm'] = [
        BUILDING_TYPES.FARM,
        BUILDING_TYPES.FARM,
        BUILDING_TYPES.FARM,
        BUILDING_TYPES.FARM,
        BUILDING_TYPES.FARM,
        BUILDING_TYPES.FARM,
        BUILDING_TYPES.FARM,
        BUILDING_TYPES.FARM,
        BUILDING_TYPES.FARM,
        BUILDING_TYPES.FARM,
        BUILDING_TYPES.FARM,
        BUILDING_TYPES.FARM,
        BUILDING_TYPES.FARM,
        BUILDING_TYPES.FARM,
        BUILDING_TYPES.FARM,
        BUILDING_TYPES.FARM,
        BUILDING_TYPES.FARM,
        BUILDING_TYPES.FARM,
        BUILDING_TYPES.FARM,
        BUILDING_TYPES.FARM,
        BUILDING_TYPES.FARM,
        BUILDING_TYPES.FARM,
        BUILDING_TYPES.FARM,
        BUILDING_TYPES.FARM,
        BUILDING_TYPES.FARM,
        BUILDING_TYPES.FARM,
        BUILDING_TYPES.FARM,
        BUILDING_TYPES.FARM,
        BUILDING_TYPES.FARM,
        BUILDING_TYPES.FARM // 30
    ]

    return parseSequences(defaultSequences)
})

define('two/builderQueue/events', [], function () {
    angular.extend(eventTypeProvider, {
        BUILDER_QUEUE_JOB_STARTED: 'builder_queue_job_started',
        BUILDER_QUEUE_START: 'builder_queue_start',
        BUILDER_QUEUE_STOP: 'builder_queue_stop',
        BUILDER_QUEUE_UNKNOWN_SETTING: 'builder_queue_settings_unknown_setting',
        BUILDER_QUEUE_CLEAR_LOGS: 'builder_queue_clear_logs',
        BUILDER_QUEUE_BUILDING_SEQUENCES_UPDATED: 'builder_queue_building_orders_updated',
        BUILDER_QUEUE_BUILDING_SEQUENCES_ADDED: 'builder_queue_building_orders_added',
        BUILDER_QUEUE_BUILDING_SEQUENCES_REMOVED: 'builder_queue_building_orders_removed',
        BUILDER_QUEUE_SETTINGS_CHANGE: 'builder_queue_settings_change',
        BUILDER_QUEUE_NO_SEQUENCES: 'builder_queue_no_sequences',
        COMMAND_QUEUE_ADD_INVALID_OFFICER: 'command_queue_add_invalid_officer',
        COMMAND_QUEUE_ADD_RELOCATE_DISABLED: 'command_queue_add_relocate_disabled'
    })
})


define('two/builderQueue/ui', [
    'two/ui',
    'two/builderQueue',
    'two/utils',
    'two/ready',
    'two/Settings',
    'two/builderQueue/settings',
    'two/builderQueue/settings/map',
    'two/builderQueue/sequenceStatus',
    'conf/buildingTypes',
    'two/EventScope',
    'queues/EventQueue',
    'helper/time'
], function (
    interfaceOverflow,
    builderQueue,
    utils,
    ready,
    Settings,
    SETTINGS,
    SETTINGS_MAP,
    SEQUENCE_STATUS,
    BUILDING_TYPES,
    EventScope,
    eventQueue,
    timeHelper
) {
    let $scope
    let $button
    let groupList = modelDataService.getGroupList()
    let buildingsLevelPoints = {}
    let running = false
    let gameDataBuildings
    let editorView = {
        sequencesAvail: true,
        modal: {}
    }
    let settings
    let settingsView = {
        sequencesAvail: true
    }
    let logsView = {}
    const TAB_TYPES = {
        SETTINGS: 'settings',
        SEQUENCES: 'sequences',
        LOGS: 'logs'
    }
    let villagesInfo = {}
    let villagesLabel = {}
    let unsavedChanges = false
    let oldCloseWindow
    let ignoreInputChange = false

    // TODO: make it shared with other modules
    const loadVillageInfo = function (villageId) {
        if (villagesInfo[villageId]) {
            return villagesInfo[villageId]
        }

        villagesInfo[villageId] = true
        villagesLabel[villageId] = 'LOADING...'

        socketService.emit(routeProvider.MAP_GET_VILLAGE_DETAILS, {
            my_village_id: modelDataService.getSelectedVillage().getId(),
            village_id: villageId,
            num_reports: 1
        }, function (data) {
            villagesInfo[villageId] = {
                x: data.village_x,
                y: data.village_y,
                name: data.village_name,
                last_report: data.last_reports[0]
            }

            villagesLabel[villageId] = `${data.village_name} (${data.village_x}|${data.village_y})`
        })
    }

    const buildingLevelReached = function (building, level) {
        const buildingData = modelDataService.getSelectedVillage().getBuildingData()
        return buildingData.getBuildingLevel(building) >= level
    }

    const buildingLevelProgress = function (building, level) {
        const queue = modelDataService.getSelectedVillage().getBuildingQueue().getQueue()
        let progress = false

        queue.some(function (job) {
            if (job.building === building && job.level === level) {
                return progress = true
            }
        })

        return progress
    }

    /**
     * Calculate the total of points accumulated ultil the specified level.
     */
    const getLevelScale = function (factor, base, level) {
        return level ? parseInt(Math.round(factor * Math.pow(base, level - 1)), 10) : 0
    }

    const moveArrayItem = function (obj, oldIndex, newIndex) {
        if (newIndex >= obj.length) {
            let i = newIndex - obj.length + 1
            
            while (i--) {
                obj.push(undefined)
            }
        }

        obj.splice(newIndex, 0, obj.splice(oldIndex, 1)[0])
    }

    const parseBuildingSequence = function (sequence) {
        return sequence.map(function (item) {
            return item.building
        })
    }

    const createBuildingSequence = function (sequenceId, sequence) {
        const status = builderQueue.addBuildingSequence(sequenceId, sequence)

        switch (status) {
            case SEQUENCE_STATUS.SEQUENCE_SAVED: {
                return true
            }
            case SEQUENCE_STATUS.SEQUENCE_EXISTS: {
                utils.notif('error', $filter('i18n')('error_sequence_exists', $rootScope.loc.ale, 'builder_queue'))
                return false
            }
            case SEQUENCE_STATUS.SEQUENCE_INVALID: {
                utils.notif('error', $filter('i18n')('error_sequence_invalid', $rootScope.loc.ale, 'builder_queue'))
                return false
            }
        }
    }

    const selectSome = function (obj) {
        for (let i in obj) {
            if (hasOwn.call(obj, i)) {
                return i
            }
        }

        return false
    }

    settingsView.generateSequences = function () {
        const sequences = settings.get(SETTINGS.BUILDING_SEQUENCES)
        const sequencesAvail = Object.keys(sequences).length

        settingsView.sequencesAvail = sequencesAvail

        if (!sequencesAvail) {
            return false
        }

        settingsView.generateBuildingSequence()
        settingsView.generateBuildingSequenceFinal()
        settingsView.updateVisibleBuildingSequence()
    }

    settingsView.generateBuildingSequence = function () {
        const sequenceId = $scope.settings[SETTINGS.ACTIVE_SEQUENCE].value
        const buildingSequenceRaw = $scope.settings[SETTINGS.BUILDING_SEQUENCES][sequenceId]
        const buildingData = modelDataService.getGameData().getBuildings()
        let buildingLevels = {}

        settingsView.sequencesAvail = !!buildingSequenceRaw

        if (!settingsView.sequencesAvail) {
            return false
        }

        for (let building in BUILDING_TYPES) {
            buildingLevels[BUILDING_TYPES[building]] = 0
        }

        settingsView.buildingSequence = buildingSequenceRaw.map(function (building) {
            let level = ++buildingLevels[building]
            let price = buildingData[building].individual_level_costs[level]
            let state = 'not-reached'

            if (buildingLevelReached(building, level)) {
                state = 'reached'
            } else if (buildingLevelProgress(building, level)) {
                state = 'progress'
            }

            return {
                level: level,
                price: buildingData[building].individual_level_costs[level],
                building: building,
                duration: timeHelper.readableSeconds(price.build_time),
                levelPoints: buildingsLevelPoints[building][level - 1],
                state: state
            }
        })
    }

    settingsView.generateBuildingSequenceFinal = function (_sequenceId) {
        const selectedSequence = $scope.settings[SETTINGS.ACTIVE_SEQUENCE].value
        const sequenceBuildings = $scope.settings[SETTINGS.BUILDING_SEQUENCES][_sequenceId || selectedSequence]
        let sequenceObj = {}
        let sequence = []
        
        for (let building in gameDataBuildings) {
            sequenceObj[building] = {
                level: 0,
                order: gameDataBuildings[building].order,
                resources: {
                    wood: 0,
                    clay: 0,
                    iron: 0,
                    food: 0
                },
                points: 0,
                build_time: 0
            }
        }

        sequenceBuildings.forEach(function (building) {
            let level = ++sequenceObj[building].level
            let costs = gameDataBuildings[building].individual_level_costs[level]

            sequenceObj[building].resources.wood += parseInt(costs.wood, 10)
            sequenceObj[building].resources.clay += parseInt(costs.clay, 10)
            sequenceObj[building].resources.iron += parseInt(costs.iron, 10)
            sequenceObj[building].resources.food += parseInt(costs.food, 10)
            sequenceObj[building].build_time += parseInt(costs.build_time, 10)
            sequenceObj[building].points += buildingsLevelPoints[building][level - 1]
        })

        for (let building in sequenceObj) {
            if (sequenceObj[building].level !== 0) {
                sequence.push({
                    building: building,
                    level: sequenceObj[building].level,
                    order: sequenceObj[building].order,
                    resources: sequenceObj[building].resources,
                    points: sequenceObj[building].points,
                    build_time: sequenceObj[building].build_time
                })
            }
        }

        settingsView.buildingSequenceFinal = sequence
    }

    settingsView.updateVisibleBuildingSequence = function () {
        const offset = $scope.pagination.buildingSequence.offset
        const limit = $scope.pagination.buildingSequence.limit

        settingsView.visibleBuildingSequence = settingsView.buildingSequence.slice(offset, offset + limit)
        $scope.pagination.buildingSequence.count = settingsView.buildingSequence.length
    }

    settingsView.generateBuildingsLevelPoints = function () {
        const $gameData = modelDataService.getGameData()
        let buildingTotalPoints

        for(let buildingName in $gameData.data.buildings) {
            let buildingData = $gameData.getBuildingDataForBuilding(buildingName)
            buildingTotalPoints = 0
            buildingsLevelPoints[buildingName] = []

            for (let level = 1; level <= buildingData.max_level; level++) {
                let currentLevelPoints  = getLevelScale(buildingData.points, buildingData.points_factor, level)
                let levelPoints = currentLevelPoints - buildingTotalPoints
                buildingTotalPoints += levelPoints

                buildingsLevelPoints[buildingName].push(levelPoints)
            }
        }
    }

    editorView.moveUp = function () {
        let copy = angular.copy(editorView.buildingSequence)
        let changed = false

        for (let i = 0; i < copy.length; i++) {
            let item = copy[i]

            if (!item.checked) {
                continue
            }

            if (i === 0) {
                continue
            }

            if (copy[i - 1].checked) {
                continue
            }

            if (copy[i - 1].building === item.building) {
                copy[i - 1].level++
                item.level--
                changed = true
            }

            moveArrayItem(copy, i, i - 1)
        }

        editorView.buildingSequence = copy
        editorView.updateVisibleBuildingSequence()

        if (changed) {
            unsavedChanges = true
        }
    }

    editorView.moveDown = function () {
        let copy = angular.copy(editorView.buildingSequence)
        let changed = false

        for (let i = copy.length - 1; i >= 0; i--) {
            let item = copy[i]

            if (!item.checked) {
                continue
            }

            if (i === copy.length - 1) {
                continue
            }

            if (copy[i + 1].checked) {
                continue
            }

            if (copy[i + 1].building === item.building) {
                copy[i + 1].level--
                item.level++
                changed = true
            }

            moveArrayItem(copy, i, i + 1)
        }

        editorView.buildingSequence = copy
        editorView.updateVisibleBuildingSequence()
        
        if (changed) {
            unsavedChanges = true
        }
    }

    editorView.addBuilding = function (building, position, amount = 1) {
        const index = position - 1
        let newSequence = editorView.buildingSequence.slice()
        let buildingData = {
            level: null,
            building: building,
            checked: false
        }

        for (let i = 0; i < amount; i++) {
            newSequence.splice(index, 0, buildingData)
        }

        editorView.buildingSequence = editorView.updateLevels(newSequence, building)
        editorView.updateVisibleBuildingSequence()
        unsavedChanges = true

        return true
    }

    editorView.removeBuilding = function (index) {
        const building = editorView.buildingSequence[index].building

        editorView.buildingSequence.splice(index, 1)
        editorView.buildingSequence = editorView.updateLevels(editorView.buildingSequence, building)

        editorView.updateVisibleBuildingSequence()
        unsavedChanges = true
    }

    editorView.updateLevels = function (sequence, building) {
        let buildingLevel = 0
        let modifiedSequence = []

        for (let i = 0; i < sequence.length; i++) {
            let item = sequence[i]

            if (item.building === building) {
                if (buildingLevel < gameDataBuildings[building].max_level) {
                    modifiedSequence.push({
                        level: ++buildingLevel,
                        building: building,
                        checked: false
                    })
                }
            } else {
                modifiedSequence.push(item)
            }
        }

        return modifiedSequence
    }

    editorView.generateBuildingSequence = function () {
        const sequences = settings.get(SETTINGS.BUILDING_SEQUENCES)
        const sequencesAvail = Object.keys(sequences).length

        editorView.sequencesAvail = sequencesAvail

        if (!sequencesAvail) {
            return false
        }

        const sequenceId = editorView.selectedSequence.value
        const buildingSequenceRaw = sequences[sequenceId]
        let buildingLevels = {}

        for (let building in BUILDING_TYPES) {
            buildingLevels[BUILDING_TYPES[building]] = 0
        }

        editorView.buildingSequence = buildingSequenceRaw.map(function (building) {
            return {
                level: ++buildingLevels[building],
                building: building,
                checked: false
            }
        })

        editorView.updateVisibleBuildingSequence()
    }

    editorView.updateVisibleBuildingSequence = function () {
        const offset = $scope.pagination.buildingSequenceEditor.offset
        const limit = $scope.pagination.buildingSequenceEditor.limit

        editorView.visibleBuildingSequence = editorView.buildingSequence.slice(offset, offset + limit)
        $scope.pagination.buildingSequenceEditor.count = editorView.buildingSequence.length
    }

    editorView.updateBuildingSequence = function () {
        const selectedSequence = editorView.selectedSequence.value
        const parsedSequence = parseBuildingSequence(editorView.buildingSequence)
        const status = builderQueue.updateBuildingSequence(selectedSequence, parsedSequence)

        switch (status) {
            case SEQUENCE_STATUS.SEQUENCE_SAVED: {
                unsavedChanges = false
                break
            }
            case SEQUENCE_STATUS.SEQUENCE_NO_EXISTS: {
                utils.notif('error', $filter('i18n')('error_sequence_no_exits', $rootScope.loc.ale, 'builder_queue'))
                break
            }
            case SEQUENCE_STATUS.SEQUENCE_INVALID: {
                utils.notif('error', $filter('i18n')('error_sequence_invalid', $rootScope.loc.ale, 'builder_queue'))
                break
            }
        }
    }

    editorView.modal.removeSequence = function () {
        let modalScope = $rootScope.$new()

        modalScope.title = $filter('i18n')('title', $rootScope.loc.ale, 'builder_queue_remove_sequence_modal')
        modalScope.text = $filter('i18n')('text', $rootScope.loc.ale, 'builder_queue_remove_sequence_modal')
        modalScope.submitText = $filter('i18n')('remove', $rootScope.loc.ale, 'common')
        modalScope.cancelText = $filter('i18n')('cancel', $rootScope.loc.ale, 'common')
        modalScope.switchColors = true

        modalScope.submit = function () {
            modalScope.closeWindow()
            builderQueue.removeSequence(editorView.selectedSequence.value)
            unsavedChanges = false
        }

        modalScope.cancel = function () {
            modalScope.closeWindow()
        }

        windowManagerService.getModal('modal_attention', modalScope)
    }

    editorView.modal.addBuilding = function () {
        let modalScope = $rootScope.$new()
        modalScope.buildings = []
        modalScope.position = editorView.lastAddedIndex
        modalScope.indexLimit = editorView.buildingSequence.length + 1
        modalScope.buildingsData = modelDataService.getGameData().getBuildings()
        modalScope.amount = 1
        modalScope.selectedBuilding = {
            name: $filter('i18n')(editorView.lastAddedBuilding, $rootScope.loc.ale, 'building_names'),
            value: editorView.lastAddedBuilding
        }

        for (let building in gameDataBuildings) {
            modalScope.buildings.push({
                name: $filter('i18n')(building, $rootScope.loc.ale, 'building_names'),
                value: building
            })
        }

        modalScope.add = function () {
            const building = modalScope.selectedBuilding.value
            const position = modalScope.position
            const amount = modalScope.amount
            const buildingName = $filter('i18n')(building, $rootScope.loc.ale, 'building_names')
            const buildingLimit = gameDataBuildings[building].max_level

            editorView.lastAddedBuilding = building
            editorView.lastAddedIndex = position

            if (editorView.addBuilding(building, position, amount)) {
                modalScope.closeWindow()
                utils.notif('success', $filter('i18n')('add_building_success', $rootScope.loc.ale, 'builder_queue', buildingName, position))
            } else {
                utils.notif('error', $filter('i18n')('add_building_limit_exceeded', $rootScope.loc.ale, 'builder_queue', buildingName, buildingLimit))
            }
        }

        windowManagerService.getModal('!twoverflow_builder_queue_add_building_modal', modalScope)
    }

    editorView.modal.nameSequence = function () {
        const nameSequence = function () {
            let modalScope = $rootScope.$new()
            const selectedSequenceName = editorView.selectedSequence.name
            const selectedSequence = $scope.settings[SETTINGS.BUILDING_SEQUENCES][selectedSequenceName]
            
            modalScope.name = selectedSequenceName

            modalScope.submit = function () {
                if (modalScope.name.length < 3) {
                    utils.notif('error', $filter('i18n')('name_sequence_min_lenght', $rootScope.loc.ale, 'builder_queue'))
                    return false
                }

                if (createBuildingSequence(modalScope.name, selectedSequence)) {
                    modalScope.closeWindow()
                }
            }

            windowManagerService.getModal('!twoverflow_builder_queue_name_sequence_modal', modalScope)
        }

        if (unsavedChanges) {
            let modalScope = $rootScope.$new()
            modalScope.title = $filter('i18n')('clone_warn_changed_sequence_title', $rootScope.loc.ale, 'builder_queue')
            modalScope.text = $filter('i18n')('clone_warn_changed_sequence_text', $rootScope.loc.ale, 'builder_queue')
            modalScope.submitText = $filter('i18n')('clone', $rootScope.loc.ale, 'builder_queue')
            modalScope.cancelText = $filter('i18n')('cancel', $rootScope.loc.ale, 'common')

            modalScope.submit = function () {
                modalScope.closeWindow()
                nameSequence()
            }

            modalScope.cancel = function () {
                modalScope.closeWindow()
            }

            windowManagerService.getModal('modal_attention', modalScope)
        } else {
            nameSequence()
        }
    }

    logsView.updateVisibleLogs = function () {
        const offset = $scope.pagination.logs.offset
        const limit = $scope.pagination.logs.limit

        logsView.visibleLogs = logsView.logs.slice(offset, offset + limit)
        $scope.pagination.logs.count = logsView.logs.length

        logsView.visibleLogs.forEach(function (log) {
            if (log.villageId) {
                loadVillageInfo(log.villageId)
            }
        })
    }

    logsView.clearLogs = function () {
        builderQueue.clearLogs()
    }

    const createSequence = function () {
        let modalScope = $rootScope.$new()
        const initialSequence = [BUILDING_TYPES.HEADQUARTER]

        modalScope.name = ''
        
        modalScope.submit = function () {
            if (modalScope.name.length < 3) {
                utils.notif('error', $filter('i18n')('name_sequence_min_lenght', $rootScope.loc.ale, 'builder_queue'))
                return false
            }

            if (createBuildingSequence(modalScope.name, initialSequence)) {
                $scope.settings[SETTINGS.ACTIVE_SEQUENCE] = { name: modalScope.name, value: modalScope.name }
                $scope.settings[SETTINGS.BUILDING_SEQUENCES][modalScope.name] = initialSequence

                saveSettings()

                settingsView.selectedSequence = { name: modalScope.name, value: modalScope.name }
                editorView.selectedSequence = { name: modalScope.name, value: modalScope.name }

                settingsView.generateSequences()
                editorView.generateBuildingSequence()

                modalScope.closeWindow()
                selectTab(TAB_TYPES.SEQUENCES)
            }
        }

        windowManagerService.getModal('!twoverflow_builder_queue_name_sequence_modal', modalScope)
    }

    const selectTab = function (tabType) {
        $scope.selectedTab = tabType
    }

    const saveSettings = function () {
        settings.setAll(settings.decode($scope.settings))
        unsavedChanges = false
    }

    const switchBuilder = function () {
        if (builderQueue.isRunning()) {
            builderQueue.stop()
        } else {
            builderQueue.start()
        }
    }

    const confirmDiscardModal = function (onDiscard, onCancel) {
        let modalScope = $rootScope.$new()
        modalScope.title = $filter('i18n')('discard_changes_title', $rootScope.loc.ale, 'builder_queue')
        modalScope.text = $filter('i18n')('discard_changes_text', $rootScope.loc.ale, 'builder_queue')
        modalScope.submitText = $filter('i18n')('discard', $rootScope.loc.ale, 'common')
        modalScope.cancelText = $filter('i18n')('cancel', $rootScope.loc.ale, 'common')
        modalScope.switchColors = true

        modalScope.submit = function () {
            modalScope.closeWindow()
            onDiscard && onDiscard()
        }

        modalScope.cancel = function () {
            modalScope.closeWindow()
            onCancel && onCancel()
        }

        windowManagerService.getModal('modal_attention', modalScope)
    }

    const confirmCloseWindow = function () {
        if (unsavedChanges) {
            confirmDiscardModal(function onDiscard () {
                oldCloseWindow()
            })
        } else {
            oldCloseWindow()
        }
    }

    const eventHandlers = {
        updateGroups: function () {
            $scope.groups = Settings.encodeList(groupList.getGroups(), {
                type: 'groups',
                disabled: true
            })
        },
        updateSequences: function () {
            const sequences = settings.get(SETTINGS.BUILDING_SEQUENCES)
            
            $scope.sequences = Settings.encodeList(sequences, {
                type: 'keys',
                disabled: false
            })
        },
        generateBuildingSequences: function () {
            settingsView.generateSequences()
        },
        generateBuildingSequencesEditor: function () {
            editorView.generateBuildingSequence()
        },
        updateLogs: function () {
            $scope.logs = builderQueue.getLogs()
            logsView.updateVisibleLogs()
        },
        clearLogs: function () {
            utils.notif('success', $filter('i18n')('logs_cleared', $rootScope.loc.ale, 'builder_queue'))
            eventHandlers.updateLogs()
        },
        buildingSequenceUpdate: function (event, sequenceId) {
            const sequences = settings.get(SETTINGS.BUILDING_SEQUENCES)
            $scope.settings[SETTINGS.BUILDING_SEQUENCES][sequenceId] = sequences[sequenceId]

            if ($scope.settings[SETTINGS.ACTIVE_SEQUENCE].value === sequenceId) {
                settingsView.generateSequences()
            }

            utils.notif('success', $filter('i18n')('sequence_updated', $rootScope.loc.ale, 'builder_queue', sequenceId))
        },
        buildingSequenceAdd: function (event, sequenceId) {
            const sequences = settings.get(SETTINGS.BUILDING_SEQUENCES)
            $scope.settings[SETTINGS.BUILDING_SEQUENCES][sequenceId] = sequences[sequenceId]
            eventHandlers.updateSequences()
            utils.notif('success', $filter('i18n')('sequence_created', $rootScope.loc.ale, 'builder_queue', sequenceId))
        },
        buildingSequenceRemoved: function (event, sequenceId) {
            delete $scope.settings[SETTINGS.BUILDING_SEQUENCES][sequenceId]

            const substituteSequence = selectSome($scope.settings[SETTINGS.BUILDING_SEQUENCES])
            editorView.selectedSequence = { name: substituteSequence, value: substituteSequence }
            eventHandlers.updateSequences()
            editorView.generateBuildingSequence()

            if (settings.get(SETTINGS.ACTIVE_SEQUENCE) === sequenceId) {
                settings.set(SETTINGS.ACTIVE_SEQUENCE, substituteSequence, {
                    quiet: true
                })
                settingsView.generateSequences()
            }

            utils.notif('success', $filter('i18n')('sequence_removed', $rootScope.loc.ale, 'builder_queue', sequenceId))
        },
        saveSettings: function () {
            utils.notif('success', $filter('i18n')('settings_saved', $rootScope.loc.ale, 'builder_queue'))
        },
        started: function () {
            $scope.running = true
        },
        stopped: function () {
            $scope.running = false
        }
    }

    const init = function () {
        gameDataBuildings = modelDataService.getGameData().getBuildings()
        settingsView.generateBuildingsLevelPoints()
        settings = builderQueue.getSettings()

        $button = interfaceOverflow.addMenuButton2('Budowniczy', 20)
        $button.addEventListener('click', buildWindow)

        eventQueue.register(eventTypeProvider.BUILDER_QUEUE_START, function () {
            running = true
            $button.classList.remove('btn-orange')
            $button.classList.add('btn-red')
            utils.notif('success', $filter('i18n')('started', $rootScope.loc.ale, 'builder_queue'))
        })

        eventQueue.register(eventTypeProvider.BUILDER_QUEUE_STOP, function () {
            running = false
            $button.classList.remove('btn-red')
            $button.classList.add('btn-orange')
            utils.notif('success', $filter('i18n')('stopped', $rootScope.loc.ale, 'builder_queue'))
        })

        interfaceOverflow.addTemplate('twoverflow_builder_queue_window', `<div id=\"two-builder-queue\" class=\"win-content two-window\"><header class=\"win-head\"><h2>Budowniczy</h2><ul class=\"list-btn\"><li><a href=\"#\" class=\"size-34x34 btn-red icon-26x26-close\" ng-click=\"closeWindow()\"></a></ul></header><div class=\"win-main small-select\" scrollbar=\"\"><div class=\"tabs tabs-bg\"><div class=\"tabs-three-col\"><div class=\"tab\" ng-click=\"selectTab(TAB_TYPES.SETTINGS)\" ng-class=\"{'tab-active': selectedTab == TAB_TYPES.SETTINGS}\"><div class=\"tab-inner\"><div ng-class=\"{'box-border-light': selectedTab === TAB_TYPES.SETTINGS}\"><a href=\"#\" ng-class=\"{'btn-icon btn-orange': selectedTab !== TAB_TYPES.SETTINGS}\">{{ TAB_TYPES.SETTINGS | i18n:loc.ale:'common' }}</a></div></div></div><div class=\"tab\" ng-click=\"selectTab(TAB_TYPES.SEQUENCES)\" ng-class=\"{'tab-active': selectedTab == TAB_TYPES.SEQUENCES}\"><div class=\"tab-inner\"><div ng-class=\"{'box-border-light': selectedTab === TAB_TYPES.SEQUENCES}\"><a href=\"#\" ng-class=\"{'btn-icon btn-orange': selectedTab !== TAB_TYPES.SEQUENCES}\">{{ TAB_TYPES.SEQUENCES | i18n:loc.ale:'builder_queue' }}</a></div></div></div><div class=\"tab\" ng-click=\"selectTab(TAB_TYPES.LOGS)\" ng-class=\"{'tab-active': selectedTab == TAB_TYPES.LOGS}\"><div class=\"tab-inner\"><div ng-class=\"{'box-border-light': selectedTab === TAB_TYPES.LOGS}\"><a href=\"#\" ng-class=\"{'btn-icon btn-orange': selectedTab !== TAB_TYPES.LOGS}\">{{ TAB_TYPES.LOGS | i18n:loc.ale:'common' }}</a></div></div></div></div></div><div class=\"box-paper footer\"><div class=\"scroll-wrap\"><div ng-show=\"selectedTab === TAB_TYPES.SETTINGS\"><h5 class=\"twx-section\">{{ 'settings' | i18n:loc.ale:'builder_queue' }}</h5><table class=\"settings tbl-border-light tbl-striped\"><col width=\"40%\"><col><col width=\"60px\"><tr><td><span class=\"ff-cell-fix\">{{ 'settings_village_groups' | i18n:loc.ale:'builder_queue' }}</span><td colspan=\"2\" class=\"text-right\"><div select=\"\" list=\"groups\" selected=\"settings[SETTINGS.GROUP_VILLAGES]\" drop-down=\"true\"></div><tr ng-show=\"settingsView.sequencesAvail\"><td><span class=\"ff-cell-fix\">{{ 'settings_building_sequence' | i18n:loc.ale:'builder_queue' }}</span><td colspan=\"2\" class=\"text-right\"><div select=\"\" list=\"sequences\" selected=\"settings[SETTINGS.ACTIVE_SEQUENCE]\" drop-down=\"true\"></div><tr><td><span class=\"ff-cell-fix\">{{ 'settings_preserve_wood' | i18n:loc.ale:'builder_queue' }}</span><td><div range-slider=\"\" min=\"settingsMap[SETTINGS.PRESERVE_WOOD].min\" max=\"settingsMap[SETTINGS.PRESERVE_WOOD].max\" value=\"settings[SETTINGS.PRESERVE_WOOD]\" enabled=\"true\"></div><td><input type=\"number\" class=\"preserve-resource textfield-border text-center\" ng-model=\"settings[SETTINGS.PRESERVE_WOOD]\"><tr><td><span class=\"ff-cell-fix\">{{ 'settings_preserve_clay' | i18n:loc.ale:'builder_queue' }}</span><td><div range-slider=\"\" min=\"settingsMap[SETTINGS.PRESERVE_CLAY].min\" max=\"settingsMap[SETTINGS.PRESERVE_CLAY].max\" value=\"settings[SETTINGS.PRESERVE_CLAY]\" enabled=\"true\"></div><td><input type=\"number\" class=\"preserve-resource textfield-border text-center\" ng-model=\"settings[SETTINGS.PRESERVE_CLAY]\"><tr><td><span class=\"ff-cell-fix\">{{ 'settings_preserve_iron' | i18n:loc.ale:'builder_queue' }}</span><td><div range-slider=\"\" min=\"settingsMap[SETTINGS.PRESERVE_IRON].min\" max=\"settingsMap[SETTINGS.PRESERVE_IRON].max\" value=\"settings[SETTINGS.PRESERVE_IRON]\" enabled=\"true\"></div><td><input type=\"number\" class=\"preserve-resource textfield-border text-center\" ng-model=\"settings[SETTINGS.PRESERVE_IRON]\"><tr><td colspan=\"2\"><span class=\"ff-cell-fix\">{{ 'settings_priorize_farm' | i18n:loc.ale:'builder_queue' }}</span><td class=\"text-center\"><div switch-slider=\"\" enabled=\"true\" border=\"true\" value=\"settings[SETTINGS.PRIORIZE_FARM]\" vertical=\"false\" size=\"'56x28'\"></div></table><h5 class=\"twx-section\">{{ 'settings_building_sequence' | i18n:loc.ale:'builder_queue' }}</h5><p ng-show=\"!settingsView.sequencesAvail\" class=\"text-center\"><a href=\"#\" class=\"btn-orange btn-border create-sequence\" ng-click=\"createSequence()\">{{ 'create_sequence' | i18n:loc.ale:'builder_queue' }}</a><div ng-if=\"settingsView.sequencesAvail && settingsView.visibleBuildingSequence.length\"><div class=\"page-wrap\" pagination=\"pagination.buildingSequence\"></div><table class=\"tbl-border-light header-center building-sequence\"><col width=\"5%\"><col><col width=\"7%\"><col width=\"13%\"><col width=\"8%\"><col width=\"9%\"><col width=\"9%\"><col width=\"9%\"><col width=\"6%\"><tr><th tooltip=\"\" tooltip-content=\"{{ 'position' | i18n:loc.ale:'builder_queue' }}\">#<th>{{ 'building' | i18n:loc.ale:'common' }}<th>{{ 'level' | i18n:loc.ale:'common' }}<th>{{ 'duration' | i18n:loc.ale:'common' }}<th>{{ 'points' | i18n:loc.ale:'common' }}<th><span class=\"icon-26x26-resource-wood\"></span><th><span class=\"icon-26x26-resource-clay\"></span><th><span class=\"icon-26x26-resource-iron\"></span><th><span class=\"icon-26x26-resource-food\"></span><tr ng-repeat=\"item in settingsView.visibleBuildingSequence track by $index\" class=\"{{ item.state }}\"><td>{{ pagination.buildingSequence.offset + $index + 1 }}<td><span class=\"building-icon icon-20x20-building-{{ item.building }}\"></span> {{ item.building | i18n:loc.ale:'building_names' }}<td>{{ item.level }}<td>{{ item.duration }}<td class=\"green\">+{{ item.levelPoints | number }}<td>{{ item.price.wood | number }}<td>{{ item.price.clay | number }}<td>{{ item.price.iron | number }}<td>{{ item.price.food | number }}</table><div class=\"page-wrap\" pagination=\"pagination.buildingSequence\"></div></div><h5 ng-if=\"settingsView.sequencesAvail && settingsView.visibleBuildingSequence.length\" class=\"twx-section\">{{ 'settings_building_sequence_final' | i18n:loc.ale:'builder_queue' }}</h5><table ng-if=\"settingsView.sequencesAvail && settingsView.visibleBuildingSequence.length\" class=\"tbl-border-light tbl-striped header-center building-sequence-final\"><col><col width=\"5%\"><col width=\"12%\"><col width=\"8%\"><col width=\"11%\"><col width=\"11%\"><col width=\"11%\"><col width=\"7%\"><tr><th>{{ 'building' | i18n:loc.ale:'common' }}<th>{{ 'level' | i18n:loc.ale:'common' }}<th>{{ 'duration' | i18n:loc.ale:'common' }}<th>{{ 'points' | i18n:loc.ale:'common' }}<th><span class=\"icon-26x26-resource-wood\"></span><th><span class=\"icon-26x26-resource-clay\"></span><th><span class=\"icon-26x26-resource-iron\"></span><th><span class=\"icon-26x26-resource-food\"></span><tr ng-repeat=\"item in settingsView.buildingSequenceFinal | orderBy:'order'\"><td><span class=\"building-icon icon-20x20-building-{{ item.building }}\"></span> {{ item.building | i18n:loc.ale:'building_names' }}<td>{{ item.level }}<td>{{ item.build_time | readableSecondsFilter }}<td class=\"green\">+{{ item.points | number }}<td>{{ item.resources.wood | number }}<td>{{ item.resources.clay | number }}<td>{{ item.resources.iron | number }}<td>{{ item.resources.food | number }}</table><p ng-show=\"settingsView.sequencesAvail && !settingsView.visibleBuildingSequence.length\" class=\"text-center\">{{ 'empty_sequence' | i18n:loc.ale:'builder_queue' }}</div><div ng-show=\"selectedTab === TAB_TYPES.SEQUENCES\"><h5 class=\"twx-section\">{{ 'sequences_edit_sequence' | i18n:loc.ale:'builder_queue' }}</h5><p ng-show=\"!editorView.sequencesAvail\" class=\"text-center\"><a class=\"btn btn-orange create-sequence\" ng-click=\"createSequence()\">{{ 'create_sequence' | i18n:loc.ale:'builder_queue' }}</a><table ng-if=\"editorView.sequencesAvail\" class=\"tbl-border-light tbl-striped editor-select-sequence\"><tr><td colspan=\"2\"><span class=\"ff-cell-fix\">{{ 'sequences_select_edit' | i18n:loc.ale:'builder_queue' }}</span><td><div class=\"select-sequence-editor\" select=\"\" list=\"sequences\" selected=\"editorView.selectedSequence\" drop-down=\"true\"></div><tr><td class=\"text-center\"><a class=\"btn btn-orange create-sequence\" ng-click=\"createSequence()\">{{ 'create_sequence' | i18n:loc.ale:'builder_queue' }}</a><td class=\"text-center\"><a class=\"btn btn-orange clone-sequence\" ng-click=\"editorView.modal.nameSequence()\">{{ 'clone_sequence' | i18n:loc.ale:'builder_queue' }}</a><td class=\"text-center\"><a class=\"btn btn-red remove-sequence\" ng-click=\"editorView.modal.removeSequence()\">{{ 'remove_sequence' | i18n:loc.ale:'builder_queue' }}</a></table><div ng-if=\"editorView.sequencesAvail\"><div class=\"page-wrap\" pagination=\"pagination.buildingSequenceEditor\"></div><table ng-show=\"editorView.visibleBuildingSequence.length\" class=\"tbl-border-light tbl-striped header-center building-sequence-editor\"><col width=\"5%\"><col width=\"5%\"><col><col width=\"7%\"><col width=\"10%\"><tr><th><th tooltip=\"\" tooltip-content=\"{{ 'position' | i18n:loc.ale:'builder_queue' }}\">#<th>{{ 'building' | i18n:loc.ale:'common' }}<th>{{ 'level' | i18n:loc.ale:'common' }}<th>{{ 'actions' | i18n:loc.ale:'common' }}<tr ng-repeat=\"item in editorView.visibleBuildingSequence track by $index\" ng-class=\"{'selected': item.checked}\"><td><label class=\"size-26x26 btn-orange icon-26x26-checkbox\" ng-class=\"{'icon-26x26-checkbox-checked': item.checked}\"><input type=\"checkbox\" ng-model=\"item.checked\"></label><td>{{ pagination.buildingSequenceEditor.offset + $index + 1 }}<td><span class=\"building-icon icon-20x20-building-{{ item.building }}\"></span> {{ item.building | i18n:loc.ale:'building_names' }}<td>{{ item.level }}<td><a href=\"#\" class=\"size-20x20 btn-red icon-20x20-close\" ng-click=\"editorView.removeBuilding(pagination.buildingSequenceEditor.offset + $index)\" tooltip=\"\" tooltip-content=\"{{ 'remove_building' | i18n:loc.ale:'builder_queue' }}\"></a></table><div class=\"page-wrap\" pagination=\"pagination.buildingSequenceEditor\"></div><p ng-show=\"!editorView.visibleBuildingSequence.length\" class=\"text-center\"><a class=\"btn btn-border btn-orange\" ng-click=\"editorView.modal.addBuilding()\">{{ 'sequences_add_building' | i18n:loc.ale:'builder_queue' }}</a></div></div><div ng-show=\"selectedTab === TAB_TYPES.LOGS\" class=\"rich-text\"><div class=\"page-wrap\" pagination=\"pagination.logs\"></div><p class=\"text-center\" ng-show=\"!logsView.logs.length\">{{ 'logs_no_builds' | i18n:loc.ale:'builder_queue' }}<table class=\"tbl-border-light tbl-striped header-center logs\" ng-show=\"logsView.logs.length\"><col width=\"40%\"><col width=\"30%\"><col width=\"5%\"><col width=\"25%\"><col><thead><tr><th>{{ 'village' | i18n:loc.ale:'common' }}<th>{{ 'building' | i18n:loc.ale:'common' }}<th>{{ 'level' | i18n:loc.ale:'common' }}<th>{{ 'started_at' | i18n:loc.ale:'common' }}<tbody><tr ng-repeat=\"log in logsView.logs\"><td><a class=\"link\" ng-click=\"openVillageInfo(log.villageId)\"><span class=\"icon-20x20-village\"></span> {{ villagesLabel[log.villageId] }}</a><td><span class=\"building-icon icon-20x20-building-{{ log.building }}\"></span> {{ log.building | i18n:loc.ale:'building_names' }}<td>{{ log.level }}<td>{{ log.time | readableDateFilter:loc.ale:GAME_TIMEZONE:GAME_TIME_OFFSET }}</table><div class=\"page-wrap\" pagination=\"pagination.logs\"></div></div></div></div></div><footer class=\"win-foot\"><ul class=\"list-btn list-center\"><li ng-show=\"selectedTab === TAB_TYPES.SETTINGS && settingsView.sequencesAvail\"><a href=\"#\" class=\"btn-border btn-orange\" ng-click=\"saveSettings()\">{{ 'save' | i18n:loc.ale:'common' }}</a><li ng-show=\"selectedTab === TAB_TYPES.SETTINGS && settingsView.sequencesAvail\"><a href=\"#\" ng-class=\"{false:'btn-orange', true:'btn-red'}[running]\" class=\"btn-border\" ng-click=\"switchBuilder()\"><span ng-show=\"running\">{{ 'pause' | i18n:loc.ale:'common' }}</span> <span ng-show=\"!running\">{{ 'start' | i18n:loc.ale:'common' }}</span></a><li ng-show=\"selectedTab === TAB_TYPES.LOGS\"><a href=\"#\" class=\"btn-border btn-orange\" ng-click=\"logsView.clearLogs()\">{{ 'logs_clear' | i18n:loc.ale:'builder_queue' }}</a><li ng-show=\"selectedTab === TAB_TYPES.SEQUENCES && editorView.sequencesAvail\"><a href=\"#\" class=\"btn-border btn-orange\" ng-click=\"editorView.moveUp()\">{{ 'sequences_move_up' | i18n:loc.ale:'builder_queue' }}</a><li ng-show=\"selectedTab === TAB_TYPES.SEQUENCES && editorView.sequencesAvail\"><a href=\"#\" class=\"btn-border btn-orange\" ng-click=\"editorView.moveDown()\">{{ 'sequences_move_down' | i18n:loc.ale:'builder_queue' }}</a><li ng-show=\"selectedTab === TAB_TYPES.SEQUENCES && editorView.sequencesAvail\"><a href=\"#\" class=\"btn-border btn-orange\" ng-click=\"editorView.modal.addBuilding()\">{{ 'sequences_add_building' | i18n:loc.ale:'builder_queue' }}</a><li ng-show=\"selectedTab === TAB_TYPES.SEQUENCES && editorView.sequencesAvail\"><a href=\"#\" class=\"btn-border btn-red\" ng-click=\"editorView.updateBuildingSequence()\">{{ 'save' | i18n:loc.ale:'common' }}</a></ul></footer></div>`)
        interfaceOverflow.addTemplate('twoverflow_builder_queue_add_building_modal', `<div id=\"add-building-modal\" class=\"win-content\"><header class=\"win-head\"><h3>{{ 'title' | i18n:loc.ale:'builder_queue_add_building_modal' }}</h3><ul class=\"list-btn sprite\"><li><a href=\"#\" class=\"btn-red icon-26x26-close\" ng-click=\"closeWindow()\"></a></ul></header><div class=\"win-main\" scrollbar=\"\"><div class=\"box-paper\"><div class=\"scroll-wrap unit-operate-slider\"><table class=\"tbl-border-light tbl-striped header-center\"><col width=\"15%\"><col><col width=\"15%\"><tr><td>{{ 'building' | i18n:loc.ale:'common' }}<td colspan=\"2\"><div select=\"\" list=\"buildings\" selected=\"selectedBuilding\" drop-down=\"true\"></div><tr><td>{{ 'position' | i18n:loc.ale:'builder_queue' }}<td><div range-slider=\"\" min=\"1\" max=\"indexLimit\" value=\"position\" enabled=\"true\"></div><td><input type=\"number\" class=\"input-border text-center\" ng-model=\"position\"><tr><td>{{ 'amount' | i18n:loc.ale:'builder_queue' }}<td><div range-slider=\"\" min=\"1\" max=\"buildingsData[selectedBuilding.value].max_level\" value=\"amount\" enabled=\"true\"></div><td><input type=\"number\" class=\"input-border text-center\" ng-model=\"amount\"></table></div></div></div><footer class=\"win-foot sprite-fill\"><ul class=\"list-btn list-center\"><li><a href=\"#\" class=\"btn-red btn-border btn-premium\" ng-click=\"closeWindow()\">{{ 'cancel' | i18n:loc.ale:'common' }}</a><li><a href=\"#\" class=\"btn-orange btn-border\" ng-click=\"add()\">{{ 'add' | i18n:loc.ale:'common' }}</a></ul></footer></div>`)
        interfaceOverflow.addTemplate('twoverflow_builder_queue_name_sequence_modal', `<div id=\"name-sequence-modal\" class=\"win-content\"><header class=\"win-head\"><h3>{{ 'title' | i18n:loc.ale:'builder_queue_name_sequence_modal' }}</h3><ul class=\"list-btn sprite\"><li><a href=\"#\" class=\"btn-red icon-26x26-close\" ng-click=\"closeWindow()\"></a></ul></header><div class=\"win-main\" scrollbar=\"\"><div class=\"box-paper\"><div class=\"scroll-wrap\"><div class=\"box-border-light input-wrapper name_preset\"><form ng-submit=\"submit()\"><input focus=\"true\" ng-model=\"name\" minlength=\"3\"></form></div></div></div></div><footer class=\"win-foot sprite-fill\"><ul class=\"list-btn list-center\"><li><a href=\"#\" class=\"btn-red btn-border btn-premium\" ng-click=\"closeWindow()\">{{ 'cancel' | i18n:loc.ale:'common' }}</a><li><a href=\"#\" class=\"btn-orange btn-border\" ng-click=\"submit()\">{{ 'add' | i18n:loc.ale:'common' }}</a></ul></footer></div>`)
        interfaceOverflow.addStyle('#two-builder-queue tr.reached td{background-color:#b9af7e}#two-builder-queue tr.progress td{background-color:#af9d57}#two-builder-queue .building-sequence,#two-builder-queue .building-sequence-final,#two-builder-queue .building-sequence-editor,#two-builder-queue .logs{margin-bottom:10px}#two-builder-queue .building-sequence td,#two-builder-queue .building-sequence-final td,#two-builder-queue .building-sequence-editor td,#two-builder-queue .logs td,#two-builder-queue .building-sequence th,#two-builder-queue .building-sequence-final th,#two-builder-queue .building-sequence-editor th,#two-builder-queue .logs th{text-align:center;line-height:20px}#two-builder-queue .building-sequence-editor .selected td{background-color:#b9af7e}#two-builder-queue .editor-select-sequence{margin-bottom:13px}#two-builder-queue a.btn{height:28px;line-height:28px;padding:0 10px}#two-builder-queue .select-sequence-editor{text-align:center;margin-top:1px}#two-builder-queue .create-sequence{padding:8px 20px 8px 20px}#two-builder-queue table.settings td{padding:1px 5px}#two-builder-queue table.settings td.text-right{text-align:right}#two-builder-queue table.settings div[switch-slider]{display:inline-block;margin-top:2px}#two-builder-queue .small-select a.select-handler{height:28px;line-height:28px}#two-builder-queue .small-select a.select-button{height:28px}#two-builder-queue input.preserve-resource{width:70px;height:32px}#two-builder-queue .icon-26x26-resource-wood,#two-builder-queue .icon-26x26-resource-clay,#two-builder-queue .icon-26x26-resource-iron,#two-builder-queue .icon-26x26-resource-food{transform:scale(.8);top:-1px}#add-building-modal td{text-align:center}#add-building-modal .select-wrapper{width:250px}#add-building-modal input[type="text"]{width:60px}')
    }

    const buildWindow = function () {
        const activeSequence = settings.get(SETTINGS.ACTIVE_SEQUENCE)

        $scope = $rootScope.$new()
        $scope.selectedTab = TAB_TYPES.SETTINGS
        $scope.TAB_TYPES = TAB_TYPES
        $scope.SETTINGS = SETTINGS
        $scope.running = running
        $scope.pagination = {}
        $scope.settingsMap = settings.settingsMap

        $scope.villagesLabel = villagesLabel
        $scope.villagesInfo = villagesInfo

        $scope.editorView = editorView
        $scope.editorView.buildingSequence = {}
        $scope.editorView.visibleBuildingSequence = []
        $scope.editorView.selectedSequence = { name: activeSequence, value: activeSequence }

        $scope.editorView.lastAddedBuilding = BUILDING_TYPES.HEADQUARTER
        $scope.editorView.lastAddedIndex = 1

        $scope.settingsView = settingsView
        $scope.settingsView.buildingSequence = {}
        $scope.settingsView.buildingSequenceFinal = {}

        $scope.logsView = logsView
        $scope.logsView.logs = builderQueue.getLogs()

        // methods
        $scope.selectTab = selectTab
        $scope.switchBuilder = switchBuilder
        $scope.saveSettings = saveSettings
        $scope.createSequence = createSequence
        $scope.openVillageInfo = windowDisplayService.openVillageInfo

        settings.injectScope($scope)
        eventHandlers.updateGroups()
        eventHandlers.updateSequences()

        $scope.pagination.buildingSequence = {
            count: settingsView.buildingSequence.length,
            offset: 0,
            loader: settingsView.updateVisibleBuildingSequence,
            limit: storageService.getPaginationLimit()
        }

        $scope.pagination.buildingSequenceEditor = {
            count: editorView.buildingSequence.length,
            offset: 0,
            loader: editorView.updateVisibleBuildingSequence,
            limit: storageService.getPaginationLimit()
        }

        $scope.pagination.logs = {
            count: logsView.logs.length,
            offset: 0,
            loader: logsView.updateVisibleLogs,
            limit: storageService.getPaginationLimit()
        }

        logsView.updateVisibleLogs()

        settingsView.generateSequences()
        editorView.generateBuildingSequence()

        let eventScope = new EventScope('twoverflow_builder_queue_window')
        eventScope.register(eventTypeProvider.GROUPS_UPDATED, eventHandlers.updateGroups, true)
        eventScope.register(eventTypeProvider.GROUPS_CREATED, eventHandlers.updateGroups, true)
        eventScope.register(eventTypeProvider.GROUPS_DESTROYED, eventHandlers.updateGroups, true)
        eventScope.register(eventTypeProvider.VILLAGE_SELECTED_CHANGED, eventHandlers.generateBuildingSequences, true)
        eventScope.register(eventTypeProvider.BUILDING_UPGRADING, eventHandlers.generateBuildingSequences, true)
        eventScope.register(eventTypeProvider.BUILDING_LEVEL_CHANGED, eventHandlers.generateBuildingSequences, true)
        eventScope.register(eventTypeProvider.BUILDING_TEARING_DOWN, eventHandlers.generateBuildingSequences, true)
        eventScope.register(eventTypeProvider.VILLAGE_BUILDING_QUEUE_CHANGED, eventHandlers.generateBuildingSequences, true)
        eventScope.register(eventTypeProvider.BUILDER_QUEUE_JOB_STARTED, eventHandlers.updateLogs)
        eventScope.register(eventTypeProvider.BUILDER_QUEUE_CLEAR_LOGS, eventHandlers.clearLogs)
        eventScope.register(eventTypeProvider.BUILDER_QUEUE_BUILDING_SEQUENCES_UPDATED, eventHandlers.buildingSequenceUpdate)
        eventScope.register(eventTypeProvider.BUILDER_QUEUE_BUILDING_SEQUENCES_ADDED, eventHandlers.buildingSequenceAdd)
        eventScope.register(eventTypeProvider.BUILDER_QUEUE_BUILDING_SEQUENCES_REMOVED, eventHandlers.buildingSequenceRemoved)
        eventScope.register(eventTypeProvider.BUILDER_QUEUE_SETTINGS_CHANGE, eventHandlers.saveSettings)
        eventScope.register(eventTypeProvider.BUILDER_QUEUE_START, eventHandlers.started)
        eventScope.register(eventTypeProvider.BUILDER_QUEUE_STOP, eventHandlers.stopped)

        windowManagerService.getScreenWithInjectedScope('!twoverflow_builder_queue_window', $scope)

        oldCloseWindow = $scope.closeWindow
        $scope.closeWindow = confirmCloseWindow

        $scope.$watch('settings[SETTINGS.ACTIVE_SEQUENCE].value', function (newValue, oldValue) {
            if (newValue !== oldValue) {
                eventHandlers.generateBuildingSequences()
            }
        })

        $scope.$watch('editorView.selectedSequence.value', function (newValue, oldValue) {
            if (ignoreInputChange) {
                ignoreInputChange = false
                return
            }

            if (newValue !== oldValue) {
                if (unsavedChanges) {
                    confirmDiscardModal(function onDiscard () {
                        eventHandlers.generateBuildingSequencesEditor()
                        unsavedChanges = false
                    }, function onCancel () {
                        $scope.editorView.selectedSequence = { name: oldValue, value: oldValue }
                        ignoreInputChange = true
                    })
                } else {
                    eventHandlers.generateBuildingSequencesEditor()
                }
            }
        })
    }

    return init
})

define('two/builderQueue/settings', [], function () {
    return {
        GROUP_VILLAGES: 'group_villages',
        ACTIVE_SEQUENCE: 'building_sequence',
        BUILDING_SEQUENCES: 'building_orders',
        PRESERVE_WOOD: 'preserve_wood',
        PRESERVE_CLAY: 'preserve_clay',
        PRESERVE_IRON: 'preserve_iron',
        PRIORIZE_FARM: 'priorize_farm'
    }
})

define('two/builderQueue/settings/updates', [], function () {
    return {
        ANALYSE: 'analyse'
    }
})

define('two/builderQueue/settings/map', [
    'two/builderQueue/defaultOrders',
    'two/builderQueue/settings',
    'two/builderQueue/settings/updates'
], function (
    DEFAULT_ORDERS,
    SETTINGS,
    UPDATES
) {
    return {
        [SETTINGS.GROUP_VILLAGES]: {
            default: false,
            inputType: 'select',
            disabledOption: true,
            type: 'groups',
            updates: [UPDATES.ANALYSE]
        },
        [SETTINGS.ACTIVE_SEQUENCE]: {
            default: 'Essential',
            inputType: 'select',
            updates: [UPDATES.ANALYSE]
        },
        [SETTINGS.BUILDING_SEQUENCES]: {
            default: DEFAULT_ORDERS,
            inputType: 'buildingOrder',
            updates: [UPDATES.ANALYSE]
        },
        [SETTINGS.PRESERVE_WOOD]: {
            default: 0,
            updates: [UPDATES.ANALYSE],
            inputType: 'number',
            min: 0,
            max: 600000
        },
        [SETTINGS.PRESERVE_CLAY]: {
            default: 0,
            updates: [UPDATES.ANALYSE],
            inputType: 'number',
            min: 0,
            max: 600000
        },
        [SETTINGS.PRESERVE_IRON]: {
            default: 0,
            updates: [UPDATES.ANALYSE],
            inputType: 'number',
            min: 0,
            max: 600000
        },
        [SETTINGS.PRIORIZE_FARM]: {
            default: true,
            inputType: 'checkbox',
            updates: [UPDATES.ANALYSE]
        }
    }
})

define('two/builderQueue/sequenceStatus', [], function () {
    return {
        SEQUENCE_NO_EXISTS: 'sequence_no_exists',
        SEQUENCE_EXISTS: 'sequence_exists',
        SEQUENCE_INVALID: 'sequence_invalid',
        SEQUENCE_SAVED: 'sequence_saved'
    }
})

require([
    'two/ready',
    'two/builderQueue',
    'two/builderQueue/ui',
    'two/builderQueue/events'
], function (
    ready,
    builderQueue,
    builderQueueInterface
) {
    if (builderQueue.isInitialized()) {
        return false
    }

    ready(function () {
        builderQueue.init()
        builderQueueInterface()
    })
})

define('two/commandQueue', [
    'two/utils',
    'two/commandQueue/types/dates',
    'two/commandQueue/types/events',
    'two/commandQueue/types/filters',
    'two/commandQueue/types/commands',
    'two/commandQueue/storageKeys',
    'two/commandQueue/errorCodes',
    'queues/EventQueue',
    'helper/time',
    'helper/math',
    'struct/MapData',
    'Lockr',
    'conf/buildingTypes',
    'conf/officerTypes',
    'conf/unitTypes'
], function (
    utils,
    DATE_TYPES,
    EVENT_CODES,
    FILTER_TYPES,
    COMMAND_TYPES,
    STORAGE_KEYS,
    ERROR_CODES,
    eventQueue,
    timeHelper,
    $math,
    mapData,
    Lockr,
    BUILDING_TYPES,
    OFFICER_TYPES,
    UNIT_TYPES
) {
    const CHECKS_PER_SECOND = 10
    const COMMAND_TYPE_LIST = Object.values(COMMAND_TYPES)
    const DATE_TYPE_LIST = Object.values(DATE_TYPES)
    const UNIT_TYPE_LIST = Object.values(UNIT_TYPES)
    const OFFICER_TYPE_LIST = Object.values(OFFICER_TYPES)
    const BUILDING_TYPE_LIST = Object.values(BUILDING_TYPES)
    let waitingCommands = []
    let waitingCommandsObject = {}
    let sentCommands = []
    let expiredCommands = []
    let running = false
    let timeOffset

    const commandFilters = {
        [FILTER_TYPES.SELECTED_VILLAGE]: function (command) {
            return command.origin.id === modelDataService.getSelectedVillage().getId()
        },
        [FILTER_TYPES.BARBARIAN_TARGET]: function (command) {
            return !command.target.character_id
        },
        [FILTER_TYPES.ALLOWED_TYPES]: function (command, options) {
            return options[FILTER_TYPES.ALLOWED_TYPES][command.type]
        },
        [FILTER_TYPES.ATTACK]: function (command) {
            return command.type !== COMMAND_TYPES.ATTACK
        },
        [FILTER_TYPES.SUPPORT]: function (command) {
            return command.type !== COMMAND_TYPES.SUPPORT
        },
        [FILTER_TYPES.RELOCATE]: function (command) {
            return command.type !== COMMAND_TYPES.RELOCATE
        },
        [FILTER_TYPES.TEXT_MATCH]: function (command, options) {
            let show = true
            const keywords = options[FILTER_TYPES.TEXT_MATCH].toLowerCase().split(/\W/)

            const searchString = [
                command.origin.name,
                command.origin.x + '|' + command.origin.y,
                command.origin.character_name || '',
                command.target.name,
                command.target.x + '|' + command.target.y,
                command.target.character_name || '',
                command.target.tribe_name || '',
                command.target.tribe_tag || ''
            ].join('').toLowerCase()

            keywords.some(function (keyword) {
                if (keyword.length && !searchString.includes(keyword)) {
                    show = false
                    return true
                }
            })

            return show
        }
    }

    const timeToSend = function (sendTime) {
        return sendTime < (timeHelper.gameTime() + timeOffset)
    }

    const sortWaitingQueue = function () {
        waitingCommands = waitingCommands.sort(function (a, b) {
            return a.sendTime - b.sendTime
        })
    }

    const pushWaitingCommand = function (command) {
        waitingCommands.push(command)
    }

    const pushCommandObject = function (command) {
        waitingCommandsObject[command.id] = command
    }

    const pushSentCommand = function (command) {
        sentCommands.push(command)
    }

    const pushExpiredCommand = function (command) {
        expiredCommands.push(command)
    }

    const storeWaitingQueue = function () {
        Lockr.set(STORAGE_KEYS.QUEUE_COMMANDS, waitingCommands)
    }

    const storeSentQueue = function () {
        Lockr.set(STORAGE_KEYS.QUEUE_SENT, sentCommands)
    }

    const storeExpiredQueue = function () {
        Lockr.set(STORAGE_KEYS.QUEUE_EXPIRED, expiredCommands)
    }

    const loadStoredCommands = function () {
        const storedQueue = Lockr.get(STORAGE_KEYS.QUEUE_COMMANDS, [], true)

        utils.each(storedQueue, function (command) {
            if (timeHelper.gameTime() > command.sendTime) {
                commandQueue.expireCommand(command, EVENT_CODES.TIME_LIMIT)
            } else {
                pushWaitingCommand(command)
                pushCommandObject(command)
            }
        })
    }
    
    

    const parseDynamicUnits = function (command) {
        const playerVillages = modelDataService.getVillages()
        const village = playerVillages[command.origin.id]

        if (!village) {
            return EVENT_CODES.NOT_OWN_VILLAGE
        }

        const villageUnits = village.unitInfo.units
        let parsedUnits = {}
        let error = false

        utils.each(command.units, function (amount, unit) {
            if (amount === '*') {
                amount = villageUnits[unit].available

                if (amount === 0) {
                    return
                }
            } else if (amount < 0) {
                amount = villageUnits[unit].available - Math.abs(amount)

                if (amount < 0) {
                    error = EVENT_CODES.NOT_ENOUGH_UNITS
                    return false
                }
            } else if (amount > 0) {
                if (amount > villageUnits[unit].available) {
                    error = EVENT_CODES.NOT_ENOUGH_UNITS
                    return false
                }
            }

            parsedUnits[unit] = amount
        })

        if (angular.equals({}, parsedUnits)) {
            error = EVENT_CODES.NOT_ENOUGH_UNITS
        }

        return error || parsedUnits
    }

    const listenCommands = function () {
        setInterval(function () {
            if (!waitingCommands.length) {
                return
            }

            waitingCommands.some(function (command) {
                if (timeToSend(command.sendTime)) {
                    if (running) {
                        commandQueue.sendCommand(command)
                    } else {
                        commandQueue.expireCommand(command, EVENT_CODES.TIME_LIMIT)
                    }
                } else {
                    return true
                }
            })
        }, 1000 / CHECKS_PER_SECOND)
    }

    const validAxisCoord = function (input) {
        return !isNaN(input) && input > 0 && input < 1000
    }

    const validCoords = function (input) {
        return hasOwn.call(input, 'x') && hasOwn.call(input, 'y') && validAxisCoord(input.x) && validAxisCoord(input.y)
    }

    let commandQueue = {
        initialized: false
    }

    commandQueue.init = function () {
        timeOffset = utils.getTimeOffset()
        commandQueue.initialized = true
        sentCommands = Lockr.get(STORAGE_KEYS.QUEUE_SENT, [], true)
        expiredCommands = Lockr.get(STORAGE_KEYS.QUEUE_EXPIRED, [], true)

        loadStoredCommands()
        listenCommands()

        window.addEventListener('beforeunload', function (event) {
            if (running && waitingCommands.length) {
                event.returnValue = true
            }
        })
    }

    commandQueue.sendCommand = function (command) {
        const units = parseDynamicUnits(command)

        // units === EVENT_CODES.*
        if (typeof units === 'string') {
            return commandQueue.expireCommand(command, units)
        }

        command.units = units

        socketService.emit(routeProvider.SEND_CUSTOM_ARMY, {
            start_village: command.origin.id,
            target_village: command.target.id,
            type: command.type,
            units: command.units,
            icon: 0,
            officers: command.officers,
            catapult_target: command.catapultTarget
        })

        pushSentCommand(command)
        storeSentQueue()

        commandQueue.removeCommand(command, EVENT_CODES.COMMAND_SENT)
        eventQueue.trigger(eventTypeProvider.COMMAND_QUEUE_SEND, command)
    }

    commandQueue.expireCommand = function (command, eventCode) {
        pushExpiredCommand(command)
        storeExpiredQueue()

        commandQueue.removeCommand(command, eventCode)
    }

    commandQueue.addCommand = function (origin, target, date, dateType, units, officers, commandType, catapultTarget) {
        let parsedUnits = {}
        let parsedOfficers = {}

        return new Promise(function (resolve, reject) {
            if (!validCoords(origin)) {
                return reject(ERROR_CODES.INVALID_ORIGIN)
            }

            if (!validCoords(target)) {
                return reject(ERROR_CODES.INVALID_TARGET)
            }

            if (!utils.isValidDateTime(date)) {
                return reject(ERROR_CODES.INVALID_DATE)
            }

            if (angular.isObject(units)) {
                const validUnitType = utils.each(units, function (amount, unitName) {
                    if (!UNIT_TYPE_LIST.includes(unitName)) {
                        return false
                    }

                    amount = isNaN(amount) ? amount : parseInt(amount, 10)

                    if (amount === '*' || typeof amount === 'number' && amount !== 0) {
                        parsedUnits[unitName] = amount
                    }
                })

                if (!validUnitType) {
                    return reject(ERROR_CODES.INVALID_UNIT_TYPE)
                }
            }

            if (angular.equals(parsedUnits, {})) {
                return reject(ERROR_CODES.NO_UNITS)
            }

            if (angular.isObject(officers)) {
                const validOfficerType = utils.each(officers, function (status, officerName) {
                    if (!OFFICER_TYPE_LIST.includes(officerName)) {
                        return false
                    }

                    if (officers[officerName]) {
                        parsedOfficers[officerName] = true
                    }
                })

                if (!validOfficerType) {
                    return reject(ERROR_CODES.INVALID_OFFICER_TYPE)
                }
            }

            if (!COMMAND_TYPE_LIST.includes(commandType)) {
                return reject(ERROR_CODES.INVALID_COMMAND_TYPE)
            }

            if (commandType === COMMAND_TYPES.RELOCATE && !modelDataService.getWorldConfig().isRelocateUnitsEnabled()) {
                return reject(ERROR_CODES.RELOCATE_DISABLED)
            }

            if (commandType === COMMAND_TYPES.ATTACK && parsedOfficers[OFFICER_TYPES.SUPPORTER]) {
                delete parsedOfficers[OFFICER_TYPES.SUPPORTER]
            }

            if (typeof catapultTarget === 'string' && !BUILDING_TYPE_LIST.includes(catapultTarget)) {
                return reject(ERROR_CODES.INVALID_CATAPULT_TARGET)
            }

            if (commandType === COMMAND_TYPES.ATTACK && parsedUnits[UNIT_TYPES.CATAPULT]) {
                catapultTarget = catapultTarget || BUILDING_TYPES.HEADQUARTER
            } else {
                catapultTarget = false
            }

            if (!DATE_TYPE_LIST.includes(dateType)) {
                return reject(ERROR_CODES.INVALID_DATE_TYPE)
            }

            Promise.all([
                new Promise((resolve) => mapData.loadTownDataAsync(origin.x, origin.y, 1, 1, resolve)),
                new Promise((resolve) => mapData.loadTownDataAsync(target.x, target.y, 1, 1, resolve))
            ]).then(function (villages) {
                origin = villages[0]
                target = villages[1]

                if (!origin) {
                    return reject(ERROR_CODES.INVALID_ORIGIN)
                }

                if (!target) {
                    return reject(ERROR_CODES.INVALID_TARGET)
                }

                const inputTime = utils.getTimeFromString(date)
                const travelTime = utils.getTravelTime(origin, target, parsedUnits, commandType, parsedOfficers, true)
                const sendTime = dateType === DATE_TYPES.ARRIVE ? (inputTime - travelTime) : inputTime
                const arriveTime = dateType === DATE_TYPES.ARRIVE ? inputTime : (inputTime + travelTime)

                if (timeToSend(sendTime)) {
                    return reject(ERROR_CODES.ALREADY_SENT)
                }

                const command = {
                    id: utils.guid(),
                    travelTime: travelTime,
                    arriveTime: arriveTime,
                    sendTime: sendTime,
                    origin: origin,
                    target: target,
                    date: date,
                    dateType: dateType,
                    units: parsedUnits,
                    officers: parsedOfficers,
                    type: commandType,
                    catapultTarget: catapultTarget,
                    countdown: sendTime - timeHelper.gameTime(),
                }

                pushWaitingCommand(command)
                pushCommandObject(command)
                sortWaitingQueue()
                storeWaitingQueue()
                resolve(command)
            })
        })
    }

    commandQueue.removeCommand = function (command, eventCode) {
        delete waitingCommandsObject[command.id]

        const removed = waitingCommands.some(function (waitingCommand, index) {
            if (waitingCommand.id == command.id) {
                waitingCommands.splice(index, 1)
                storeWaitingQueue()
                return true
            }
        })

        if (removed) {
            switch (eventCode) {
                case EVENT_CODES.TIME_LIMIT: {
                    eventQueue.trigger(eventTypeProvider.COMMAND_QUEUE_SEND_TIME_LIMIT, command)
                    break
                }
                case EVENT_CODES.NOT_OWN_VILLAGE: {
                    eventQueue.trigger(eventTypeProvider.COMMAND_QUEUE_SEND_NOT_OWN_VILLAGE, command)
                    break
                }
                case EVENT_CODES.NOT_ENOUGH_UNITS: {
                    eventQueue.trigger(eventTypeProvider.COMMAND_QUEUE_SEND_NO_UNITS_ENOUGH, command)
                    break
                }
                case EVENT_CODES.COMMAND_REMOVED: {
                    eventQueue.trigger(eventTypeProvider.COMMAND_QUEUE_REMOVE, command)
                    break
                }
            }
        } else {
            eventQueue.trigger(eventTypeProvider.COMMAND_QUEUE_REMOVE_ERROR, command)
        }

        return removed
    }

    commandQueue.clearRegisters = function () {
        Lockr.set(STORAGE_KEYS.QUEUE_EXPIRED, [])
        Lockr.set(STORAGE_KEYS.QUEUE_SENT, [])
        expiredCommands = []
        sentCommands = []
    }

    commandQueue.start = function (disableNotif) {
        running = true
        eventQueue.trigger(eventTypeProvider.COMMAND_QUEUE_START, {
            disableNotif: !!disableNotif
        })
    }

    commandQueue.stop = function () {
        running = false
        eventQueue.trigger(eventTypeProvider.COMMAND_QUEUE_STOP)
    }

    commandQueue.isRunning = function () {
        return running
    }

    commandQueue.getWaitingCommands = function () {
        return waitingCommands
    }

    commandQueue.getWaitingCommandsObject = function () {
        return waitingCommandsObject
    }

    commandQueue.getSentCommands = function () {
        return sentCommands
    }

    commandQueue.getExpiredCommands = function () {
        return expiredCommands
    }

    /**
     * @param {Array} _deep - recursive command list
     */
    commandQueue.filterCommands = function (filterId, filterArgs, _deep) {
        const filter = commandFilters[filterId]
        const commands = _deep || waitingCommands

        return commands.filter(function (command) {
            return filter(command, filterArgs)
        })
    }

    return commandQueue
})

define('two/commandQueue/events', [], function () {
    angular.extend(eventTypeProvider, {
        COMMAND_QUEUE_SEND: 'commandqueue_send',
        COMMAND_QUEUE_SEND_TIME_LIMIT: 'commandqueue_send_time_limit',
        COMMAND_QUEUE_SEND_NOT_OWN_VILLAGE: 'commandqueue_send_not_own_village',
        COMMAND_QUEUE_SEND_NO_UNITS_ENOUGH: 'commandqueue_send_no_units_enough',
        COMMAND_QUEUE_ADD: 'commandqueue_add',
        COMMAND_QUEUE_ADD_INVALID_ORIGIN: 'commandqueue_add_invalid_origin',
        COMMAND_QUEUE_ADD_INVALID_TARGET: 'commandqueue_add_invalid_target',
        COMMAND_QUEUE_ADD_INVALID_DATE: 'commandqueue_add_invalid_date',
        COMMAND_QUEUE_ADD_NO_UNITS: 'commandqueue_add_no_units',
        COMMAND_QUEUE_ADD_ALREADY_SENT: 'commandqueue_add_already_sent',
        COMMAND_QUEUE_ADD_RELOCATE_DISABLED: 'command_queue_add_relocate_disabled',
        COMMAND_QUEUE_REMOVE: 'commandqueue_remove',
        COMMAND_QUEUE_REMOVE_ERROR: 'commandqueue_remove_error',
        COMMAND_QUEUE_START: 'commandqueue_start',
        COMMAND_QUEUE_STOP: 'commandqueue_stop'
    })
})

define('two/commandQueue/ui', [
    'two/ui',
    'two/commandQueue',
    'two/EventScope',
    'two/utils',
    'two/commandQueue/types/dates',
    'two/commandQueue/types/events',
    'two/commandQueue/types/filters',
    'two/commandQueue/types/commands',
    'two/commandQueue/storageKeys',
    'two/commandQueue/errorCodes',
    'queues/EventQueue',
    'struct/MapData',
    'helper/time',
    'helper/util',
    'Lockr'
], function (
    interfaceOverflow,
    commandQueue,
    EventScope,
    utils,
    DATE_TYPES,
    EVENT_CODES,
    FILTER_TYPES,
    COMMAND_TYPES,
    STORAGE_KEYS,
    ERROR_CODES,
    eventQueue,
    mapData,
    $timeHelper,
    util,
    Lockr
) {
    let $scope
    let $button
    let $gameData = modelDataService.getGameData()
    let $player
    let orderedUnitNames = $gameData.getOrderedUnitNames()
    let orderedOfficerNames = $gameData.getOrderedOfficerNames()
    let presetList = modelDataService.getPresetList()
    let mapSelectedVillage = false
    let unitOrder
    let commandData
    const TAB_TYPES = {
        ADD: 'add',
        WAITING: 'waiting',
        LOGS: 'logs'
    }
    const DEFAULT_TAB = TAB_TYPES.ADD
    const DEFAULT_CATAPULT_TARGET = 'wall'
    let attackableBuildingsList = []
    let unitList = {}
    let officerList = {}
    let timeOffset
    let activeFilters
    let filtersData
    const travelTimeArmy = {
        light_cavalry: { light_cavalry: 1 },
        heavy_cavalry: { heavy_cavalry: 1 },
        archer: { archer: 1 },
        sword: { sword: 1 },
        ram: { ram: 1 },
        snob: { snob: 1 },
        trebuchet: { trebuchet: 1 }
    }
    const FILTER_ORDER = [
        FILTER_TYPES.SELECTED_VILLAGE,
        FILTER_TYPES.BARBARIAN_TARGET,
        FILTER_TYPES.ALLOWED_TYPES,
        FILTER_TYPES.TEXT_MATCH
    ]

    const setMapSelectedVillage = function (event, menu) {
        mapSelectedVillage = menu.data
    }

    const unsetMapSelectedVillage = function () {
        mapSelectedVillage = false
    }

    /**
     * @param {Number=} _ms - Optional time to be formated instead of the game date.
     * @return {String}
     */
    const formatedDate = function (_ms) {
        const date = new Date(_ms || ($timeHelper.gameTime() + utils.getTimeOffset()))

        const rawMS = date.getMilliseconds()
        const ms = $timeHelper.zerofill(rawMS - (rawMS % 100), 3)
        const sec = $timeHelper.zerofill(date.getSeconds(), 2)
        const min = $timeHelper.zerofill(date.getMinutes(), 2)
        const hour = $timeHelper.zerofill(date.getHours(), 2)
        const day = $timeHelper.zerofill(date.getDate(), 2)
        const month = $timeHelper.zerofill(date.getMonth() + 1, 2)
        const year = date.getFullYear()

        return hour + ':' + min + ':' + sec + ':' + ms + ' ' + day + '/' + month + '/' + year
    }

    const addDateDiff = function (date, diff) {
        if (!utils.isValidDateTime(date)) {
            return ''
        }

        date = utils.getTimeFromString(date)
        date += diff

        return formatedDate(date)
    }

    const updateTravelTimes = function () {
        $scope.isValidDate = utils.isValidDateTime(commandData.date)

        if (!commandData.origin || !commandData.target) {
            return
        }

        const commandTime = $scope.isValidDate ? utils.getTimeFromString(commandData.date) : false
        const isArrive = $scope.selectedDateType.value === DATE_TYPES.ARRIVE

        utils.each(COMMAND_TYPES, function (commandType) {
            utils.each(travelTimeArmy, function (army, unit) {
                const travelTime = utils.getTravelTime(commandData.origin, commandData.target, army, commandType, commandData.officers, true)
                
                $scope.travelTimes[commandType][unit].travelTime = $filter('readableMillisecondsFilter')(travelTime)
                $scope.travelTimes[commandType][unit].status = commandTime ? sendTimeStatus(isArrive ? commandTime - travelTime : commandTime) : 'neutral'
            })
        })
    }

    /**
     * @param  {Number}  time - Command date input in milliseconds.
     * @return {Boolean}
     */
    const sendTimeStatus = function (time) {
        if (!time || !$scope.isValidDate) {
            return 'neutral'
        }

        return ($timeHelper.gameTime() + timeOffset) < time  ? 'valid' : 'invalid'
    }

    const updateDateType = function () {
        commandData.dateType = $scope.selectedDateType.value
        Lockr.set(STORAGE_KEYS.LAST_DATE_TYPE, $scope.selectedDateType.value)
        updateTravelTimes()
    }

    const updateCatapultTarget = function () {
        commandData.catapultTarget = $scope.catapultTarget.value
    }

    const insertPreset = function () {
        const selectedPreset = $scope.selectedInsertPreset.value

        if (!selectedPreset) {
            return false
        }

        const presets = modelDataService.getPresetList().getPresets()
        const preset = presets[selectedPreset]

        // reset displayed value
        $scope.selectedInsertPreset = {
            name: $filter('i18n')('add_insert_preset', $rootScope.loc.ale, 'command_queue'),
            value: null
        }

        commandData.units = angular.copy(preset.units)
        commandData.officers = angular.copy(preset.officers)

        if (preset.catapult_target) {
            commandData.catapultTarget = preset.catapult_target
            $scope.catapultTarget = {
                name: $filter('i18n')(preset.catapult_target, $rootScope.loc.ale, 'building_names'),
                value: preset.catapult_target
            }
            $scope.showCatapultSelect = true

        }
    }

    const setupCountdownForCommand = function(command) {
        if(!command.updateCountdown) {
            command.updateCountdown = function() {
                const gameClockTime = $timeHelper.serverTime() + $rootScope.GAME_TIME_OFFSET // this yields the current time displayed by the game clock
                const displaySendTime = command.sendTime - (new Date()).getTimezoneOffset()*60*1000 // at time of writing, the command.sendTime is buggy - it's off by GMT offset plus GAME_TIME_OFFSET. This corrects that for display.

                command.countdown = displaySendTime - gameClockTime
            }
        }
        $timeHelper.timer.add(command.updateCountdown)
    }

    const updateWaitingCommands = function () {
        $scope.waitingCommands = commandQueue.getWaitingCommands()
    }

    const updateSentCommands = function () {
        $scope.sentCommands = commandQueue.getSentCommands()
    }

    const updateExpiredCommands = function () {
        $scope.expiredCommands = commandQueue.getExpiredCommands()
    }

    const updateVisibleCommands = function () {
        let commands = $scope.waitingCommands

        FILTER_ORDER.forEach(function (filter) {
            if ($scope.activeFilters[filter]) {
                commands = commandQueue.filterCommands(filter, $scope.filtersData, commands)
            }
        })

        $scope.visibleWaitingCommands = commands
    }

    const onUnitInputFocus = function (unit) {
        if (commandData.units[unit] === 0) {
            commandData.units[unit] = ''
        }
    }

    const onUnitInputBlur = function (unit) {
        if (commandData.units[unit] === '') {
            commandData.units[unit] = 0
        }
    }

    const catapultTargetVisibility = function () {
        $scope.showCatapultSelect = !!commandData.units.catapult
    }

    const selectTab = function (tabType) {
        $scope.selectedTab = tabType
    }

    const addSelected = function () {
        const village = modelDataService.getSelectedVillage().data
        
        commandData.origin = {
            id: village.villageId,
            x: village.x,
            y: village.y,
            name: village.name,
            character_id: $player.getId()
        }
    }

    const addMapSelected = function () {
        if (!mapSelectedVillage) {
            return utils.notif('error', $filter('i18n')('error_no_map_selected_village', $rootScope.loc.ale, 'command_queue'))
        }

        mapData.loadTownDataAsync(mapSelectedVillage.x, mapSelectedVillage.y, 1, 1, function (data) {
            commandData.target = data
        })
    }

    const addCurrentDate = function () {
        commandData.date = formatedDate()
    }

    const incrementDate = function () {
        if (!commandData.date) {
            return false
        }

        commandData.date = addDateDiff(commandData.date, 100)
    }

    const reduceDate = function () {
        if (!commandData.date) {
            return false
        }

        commandData.date = addDateDiff(commandData.date, -100)
    }

    const cleanUnitInputs = function () {
        commandData.units = angular.copy(unitList)
        commandData.officers = angular.copy(officerList)
        commandData.catapultTarget = DEFAULT_CATAPULT_TARGET
        $scope.catapultTarget = {
            name: $filter('i18n')(DEFAULT_CATAPULT_TARGET, $rootScope.loc.ale, 'building_names'),
            value: DEFAULT_CATAPULT_TARGET
        }
        $scope.showCatapultSelect = false
    }

    const addCommand = function (commandType) {
        commandQueue.addCommand(
            commandData.origin,
            commandData.target,
            commandData.date,
            commandData.dateType,
            commandData.units,
            commandData.officers,
            commandType,
            commandData.catapultTarget
        ).then(function (command) {
            updateWaitingCommands()
            updateVisibleCommands()
            setupCountdownForCommand(command)

            utils.notif('success', genNotifText(command.type, 'added'))
        }).catch(function (error) {
            switch (error) {
                case ERROR_CODES.INVALID_ORIGIN: {
                    utils.notif('error', $filter('i18n')('error_origin', $rootScope.loc.ale, 'command_queue'))
                    break
                }
                case ERROR_CODES.INVALID_TARGET: {
                    utils.notif('error', $filter('i18n')('error_target', $rootScope.loc.ale, 'command_queue'))
                    break
                }
                case ERROR_CODES.INVALID_DATE: {
                    utils.notif('error', $filter('i18n')('error_invalid_date', $rootScope.loc.ale, 'command_queue'))
                    break
                }
                case ERROR_CODES.NO_UNITS: {
                    utils.notif('error', $filter('i18n')('error_no_units', $rootScope.loc.ale, 'command_queue'))
                    break
                }
                case ERROR_CODES.RELOCATE_DISABLED: {
                    utils.notif('error', $filter('i18n')('error_relocate_disabled', $rootScope.loc.ale, 'command_queue'))
                    break
                }
                case ERROR_CODES.ALREADY_SENT: {
                    utils.notif('error', $filter('i18n')('error_already_sent_' + commandType, $rootScope.loc.ale, 'command_queue'))
                    break
                }
            }
        })
    }

    const clearRegisters = function () {
        commandQueue.clearRegisters()
        updateSentCommands()
        updateExpiredCommands()
    }

    const switchCommandQueue = function () {
        if (commandQueue.isRunning()) {
            commandQueue.stop()
        } else {
            commandQueue.start()
        }
    }

    /**
     * Gera um texto de notificação com as traduções.
     *
     * @param  {String} key
     * @param  {String} key2
     * @param  {String=} prefix
     * @return {String}
     */
    const genNotifText = function (key, key2, prefix) {
        if (prefix) {
            key = prefix + '.' + key
        }

        const a = $filter('i18n')(key, $rootScope.loc.ale, 'command_queue')
        const b = $filter('i18n')(key2, $rootScope.loc.ale, 'command_queue')

        return a + ' ' + b
    }

    const toggleFilter = function (filter, allowedTypes) {
        $scope.activeFilters[filter] = !$scope.activeFilters[filter]

        if (allowedTypes) {
            $scope.filtersData[FILTER_TYPES.ALLOWED_TYPES][filter] = !$scope.filtersData[FILTER_TYPES.ALLOWED_TYPES][filter]
        }

        updateVisibleCommands()
    }

    const textMatchFilter = function () {
        $scope.activeFilters[FILTER_TYPES.TEXT_MATCH] = $scope.filtersData[FILTER_TYPES.TEXT_MATCH].length > 0
        updateVisibleCommands()
    }

    const eventHandlers = {
        updatePresets: function () {
            $scope.presets = utils.obj2selectOptions(presetList.getPresets())
        },
        autoCompleteSelected: function (event, id, data, type) {
            if (id !== 'commandqueue_village_search') {
                return false
            }

            commandData[type] = {
                id: data.raw.id,
                x: data.raw.x,
                y: data.raw.y,
                name: data.raw.name
            }

            $scope.searchQuery[type] = ''
        },
        removeCommand: function (event, command) {
            if(!$timeHelper.timer.remove(command.updateCountdown)) utils.notif('error', 'Error stopping command countdown. Command still removed.')
            updateWaitingCommands()
            updateVisibleCommands()
            $rootScope.$broadcast(eventTypeProvider.TOOLTIP_HIDE, 'twoverflow-tooltip')
            utils.notif('success', genNotifText(command.type, 'removed'))
        },
        removeError: function () {
            utils.notif('error', $filter('i18n')('error_remove_error', $rootScope.loc.ale, 'command_queue'))
        },
        sendTimeLimit: function (event, command) {
            updateSentCommands()
            updateExpiredCommands()
            updateWaitingCommands()
            updateVisibleCommands()
            utils.notif('error', genNotifText(command.type, 'expired'))
        },
        sendNotOwnVillage: function () {
            updateSentCommands()
            updateExpiredCommands()
            updateWaitingCommands()
            updateVisibleCommands()
            utils.notif('error', $filter('i18n')('error_not_own_village', $rootScope.loc.ale, 'command_queue'))
        },
        sendNoUnitsEnough: function () {
            updateSentCommands()
            updateExpiredCommands()
            updateWaitingCommands()
            updateVisibleCommands()
            utils.notif('error', $filter('i18n')('error_no_units_enough', $rootScope.loc.ale, 'command_queue'))
        },
        sendCommand: function (event, command) {
            if(!$timeHelper.timer.remove(command.updateCountdown)) utils.notif('error', 'Error stopping command countdown. Command still sent.')
            updateSentCommands()
            updateWaitingCommands()
            updateVisibleCommands()
            utils.notif('success', genNotifText(command.type, 'sent'))
        },
        start: function (event, data) {
            $scope.running = commandQueue.isRunning()

            if (data.disableNotif) {
                return false
            }

            utils.notif('success', genNotifText('title', 'activated'))
        },
        stop: function () {
            $scope.running = commandQueue.isRunning()
            utils.notif('success', genNotifText('title', 'deactivated'))
        },
        onAutoCompleteOrigin: function (data) {
            commandData.origin = {
                id: data.id,
                x: data.x,
                y: data.y,
                name: data.name
            }
        },
        onAutoCompleteTarget: function (data) {
            commandData.target = {
                id: data.id,
                x: data.x,
                y: data.y,
                name: data.name
            }
        },
        clearCountdownUpdates: function () {
            commandQueue.getWaitingCommands().forEach((command) => {
                $timeHelper.timer.remove(command.updateCountdown)
            })
        }
    }

    const init = function () {
        $player = modelDataService.getSelectedCharacter()
        timeOffset = utils.getTimeOffset()
        const attackableBuildingsMap = $gameData.getAttackableBuildings()

        for (let building in attackableBuildingsMap) {
            attackableBuildingsList.push({
                name: $filter('i18n')(building, $rootScope.loc.ale, 'building_names'),
                value: building
            })
        }

        unitOrder = angular.copy(orderedUnitNames)
        unitOrder.splice(unitOrder.indexOf('catapult'), 1)

        orderedUnitNames.forEach(function (unit) {
            unitList[unit] = 0
        })

        orderedOfficerNames.forEach(function (unit) {
            officerList[unit] = false
        })

        commandData = {
            origin: false,
            target: false,
            date: '',
            dateType: DATE_TYPES.OUT,
            units: angular.copy(unitList),
            officers: angular.copy(officerList),
            catapultTarget: DEFAULT_CATAPULT_TARGET,
            type: null
        }
        activeFilters = {
            [FILTER_TYPES.SELECTED_VILLAGE]: false,
            [FILTER_TYPES.BARBARIAN_TARGET]: false,
            [FILTER_TYPES.ALLOWED_TYPES]: true,
            [FILTER_TYPES.ATTACK]: true,
            [FILTER_TYPES.SUPPORT]: true,
            [FILTER_TYPES.RELOCATE]: true,
            [FILTER_TYPES.TEXT_MATCH]: false
        }
        filtersData = {
            [FILTER_TYPES.ALLOWED_TYPES]: {
                [FILTER_TYPES.ATTACK]: true,
                [FILTER_TYPES.SUPPORT]: true,
                [FILTER_TYPES.RELOCATE]: true,
            },
            [FILTER_TYPES.TEXT_MATCH]: ''
        }

        $button = interfaceOverflow.addMenuButton('Generał', 10)
        $button.addEventListener('click', buildWindow)

        eventQueue.register(eventTypeProvider.COMMAND_QUEUE_START, function () {
            $button.classList.remove('btn-orange')
            $button.classList.add('btn-red')
        })

        eventQueue.register(eventTypeProvider.COMMAND_QUEUE_STOP, function () {
            $button.classList.remove('btn-red')
            $button.classList.add('btn-orange')
        })

        $rootScope.$on(eventTypeProvider.SHOW_CONTEXT_MENU, setMapSelectedVillage)
        $rootScope.$on(eventTypeProvider.DESTROY_CONTEXT_MENU, unsetMapSelectedVillage)

        interfaceOverflow.addTemplate('twoverflow_queue_window', `<div id=\"two-command-queue\" class=\"win-content two-window\"><header class=\"win-head\"><h2>Generał</h2><ul class=\"list-btn\"><li><a href=\"#\" class=\"size-34x34 btn-red icon-26x26-close\" ng-click=\"closeWindow()\"></a></ul></header><div class=\"win-main\" scrollbar=\"\"><div class=\"tabs tabs-bg\"><div class=\"tabs-three-col\"><div class=\"tab\" ng-click=\"selectTab(TAB_TYPES.ADD)\" ng-class=\"{true:'tab-active', false:''}[selectedTab == TAB_TYPES.ADD]\"><div class=\"tab-inner\"><div ng-class=\"{'box-border-light': selectedTab === TAB_TYPES.ADD}\"><a href=\"#\" ng-class=\"{'btn-icon btn-orange': selectedTab !== TAB_TYPES.ADD}\">{{ 'tab_add' | i18n:loc.ale:'command_queue' }}</a></div></div></div><div class=\"tab\" ng-click=\"selectTab(TAB_TYPES.WAITING)\" ng-class=\"{true:'tab-active', false:''}[selectedTab == TAB_TYPES.WAITING]\"><div class=\"tab-inner\"><div ng-class=\"{'box-border-light': selectedTab === TAB_TYPES.WAITING}\"><a href=\"#\" ng-class=\"{'btn-icon btn-orange': selectedTab !== TAB_TYPES.WAITING}\">{{ 'tab_waiting' | i18n:loc.ale:'command_queue' }}</a></div></div></div><div class=\"tab\" ng-click=\"selectTab(TAB_TYPES.LOGS)\" ng-class=\"{true:'tab-active', false:''}[selectedTab == TAB_TYPES.LOGS]\"><div class=\"tab-inner\"><div ng-class=\"{'box-border-light': selectedTab === TAB_TYPES.LOGS}\"><a href=\"#\" ng-class=\"{'btn-icon btn-orange': selectedTab !== TAB_TYPES.LOGS}\">{{ 'tab_logs' | i18n:loc.ale:'command_queue' }}</a></div></div></div></div></div><div class=\"box-paper footer\"><div class=\"scroll-wrap\"><div class=\"add\" ng-show=\"selectedTab === TAB_TYPES.ADD\"><form class=\"addForm\"><div><table class=\"tbl-border-light tbl-striped basic-config\"><col width=\"30%\"><col width=\"5%\"><col><col width=\"18%\"><tr><td><div auto-complete=\"autoCompleteOrigin\"></div><td class=\"text-center\"><span class=\"icon-26x26-rte-village\"></span><td ng-if=\"!commandData.origin\" class=\"command-village\">{{ 'add_no_village' | i18n:loc.ale:'command_queue' }}<td ng-if=\"commandData.origin\" class=\"command-village\">{{ commandData.origin.name }} ({{ commandData.origin.x }}|{{ commandData.origin.y }})<td class=\"actions\"><a class=\"btn btn-orange\" ng-click=\"addSelected()\" tooltip=\"\" tooltip-content=\"{{ 'add_selected' | i18n:loc.ale:'command_queue' }}\">{{ 'selected' | i18n:loc.ale:'common' }}</a><tr><td><div auto-complete=\"autoCompleteTarget\"></div><td class=\"text-center\"><span class=\"icon-26x26-rte-village\"></span><td ng-if=\"!commandData.target\" class=\"command-village\">{{ 'add_no_village' | i18n:loc.ale:'command_queue' }}<td ng-if=\"commandData.target\" class=\"command-village\">{{ commandData.target.name }} ({{ commandData.target.x }}|{{ commandData.target.y }})<td class=\"actions\"><a class=\"btn btn-orange\" ng-click=\"addMapSelected()\" tooltip=\"\" tooltip-content=\"{{ 'add_map_selected' | i18n:loc.ale:'command_queue' }}\">{{ 'selected' | i18n:loc.ale:'common' }}</a><tr><td><input ng-model=\"commandData.date\" class=\"textfield-border date\" pattern=\"\\s*\\d{1,2}:\\d{1,2}:\\d{1,2}(:\\d{1,3})? \\d{1,2}\\/\\d{1,2}\\/\\d{4}\\s*\" placeholder=\"{{ 'add_date' | i18n:loc.ale:'command_queue' }}\" tooltip=\"\" tooltip-content=\"hh:mm:ss:SSS dd/MM/yyyy\"><td class=\"text-center\"><span class=\"icon-26x26-time\"></span><td><div select=\"\" list=\"dateTypes\" selected=\"selectedDateType\" drop-down=\"true\"></div><td class=\"actions\"><a class=\"btn btn-orange\" ng-click=\"reduceDate()\" tooltip=\"\" tooltip-content=\"{{ 'add_current_date_minus' | i18n:loc.ale:'command_queue' }}\">-</a><a class=\"btn btn-orange\" ng-click=\"addCurrentDate()\" tooltip=\"\" tooltip-content=\"{{ 'add_current_date' | i18n:loc.ale:'command_queue' }}\">{{ 'now' | i18n:loc.ale:'common' }}</a><a class=\"btn btn-orange\" ng-click=\"incrementDate()\" tooltip=\"\" tooltip-content=\"{{ 'add_current_date_plus' | i18n:loc.ale:'command_queue' }}\">+</a></table><table ng-show=\"commandData.origin && commandData.target\" class=\"tbl-border-light tbl-units tbl-speed screen-village-info\"><thead><tr><th colspan=\"7\">{{ 'speed_title' | i18n:loc.ale:'screen_village_info' }}<tbody><tr><td class=\"odd\"><div class=\"unit-wrap\"><span class=\"icon icon-34x34-unit-knight\"></span> <span class=\"icon icon-34x34-unit-light_cavalry\"></span> <span class=\"icon icon-34x34-unit-mounted_archer\"></span></div><div><div class=\"box-time-sub-icon time-attack {{ travelTimes.attack.light_cavalry.status }}\"><div class=\"time-icon icon-20x20-attack-check\" tooltip=\"\" tooltip-content=\"{{ 'travel_time_attack' | i18n:loc.ale:'military_operations' }}\"></div>{{ travelTimes.attack.light_cavalry.travelTime }}</div><div class=\"box-time-sub-icon time-support {{ travelTimes.support.light_cavalry.status }}\"><div class=\"time-icon icon-20x20-support-check\" tooltip=\"\" tooltip-content=\"{{ 'travel_time_support' | i18n:loc.ale:'military_operations' }}\"></div>{{ travelTimes.support.light_cavalry.travelTime }}</div><div ng-if=\"relocateEnabled\" class=\"box-time-sub-icon time-relocate {{ travelTimes.relocate.light_cavalry.status }}\"><div class=\"time-icon icon-20x20-relocate\" tooltip=\"\" tooltip-content=\"{{ 'travel_time_relocate' | i18n:loc.ale:'military_operations' }}\"></div>{{ travelTimes.relocate.light_cavalry.travelTime }}</div></div><td><div class=\"unit-wrap\"><span class=\"icon icon-single icon-34x34-unit-heavy_cavalry\"></span></div><div><div class=\"box-time-sub time-attack {{ travelTimes.attack.heavy_cavalry.status }}\">{{ travelTimes.attack.heavy_cavalry.travelTime }}</div><div class=\"box-time-sub time-support {{ travelTimes.support.heavy_cavalry.status }}\">{{ travelTimes.support.heavy_cavalry.travelTime }}</div><div ng-if=\"relocateEnabled\" class=\"box-time-sub time-relocate {{ travelTimes.relocate.heavy_cavalry.status }}\">{{ travelTimes.relocate.heavy_cavalry.travelTime }}</div></div><td class=\"odd\"><div class=\"unit-wrap\"><span class=\"icon icon-34x34-unit-archer\"></span> <span class=\"icon icon-34x34-unit-spear\"></span> <span class=\"icon icon-34x34-unit-axe\"></span> <span class=\"icon icon-34x34-unit-doppelsoldner\"></span></div><div><div class=\"box-time-sub time-attack {{ travelTimes.attack.archer.status }}\">{{ travelTimes.attack.archer.travelTime }}</div><div class=\"box-time-sub time-support {{ travelTimes.support.archer.status }}\">{{ travelTimes.support.archer.travelTime }}</div><div ng-if=\"relocateEnabled\" class=\"box-time-sub time-relocate {{ travelTimes.relocate.archer.status }}\">{{ travelTimes.relocate.archer.travelTime }}</div></div><td><div class=\"unit-wrap\"><span class=\"icon icon-single icon-34x34-unit-sword\"></span></div><div><div class=\"box-time-sub time-attack {{ travelTimes.attack.sword.status }}\">{{ travelTimes.attack.sword.travelTime }}</div><div class=\"box-time-sub time-support {{ travelTimes.support.sword.status }}\">{{ travelTimes.support.sword.travelTime }}</div><div ng-if=\"relocateEnabled\" class=\"box-time-sub time-relocate {{ travelTimes.relocate.sword.status }}\">{{ travelTimes.relocate.sword.travelTime }}</div></div><td class=\"odd\"><div class=\"unit-wrap\"><span class=\"icon icon-34x34-unit-catapult\"></span> <span class=\"icon icon-34x34-unit-ram\"></span></div><div><div class=\"box-time-sub time-attack {{ travelTimes.attack.ram.status }}\">{{ travelTimes.attack.ram.travelTime }}</div><div class=\"box-time-sub time-support {{ travelTimes.support.ram.status }}\">{{ travelTimes.support.ram.travelTime }}</div><div ng-if=\"relocateEnabled\" class=\"box-time-sub time-relocate {{ travelTimes.relocate.ram.status }}\">{{ travelTimes.relocate.ram.travelTime }}</div></div><td><div class=\"unit-wrap\"><span class=\"icon icon-single icon-34x34-unit-snob\"></span></div><div><div class=\"box-time-sub time-attack {{ travelTimes.attack.snob.status }}\">{{ travelTimes.attack.snob.travelTime }}</div><div class=\"box-time-sub time-support {{ travelTimes.support.snob.status }}\">{{ travelTimes.support.snob.travelTime }}</div><div ng-if=\"relocateEnabled\" class=\"box-time-sub time-relocate {{ travelTimes.relocate.snob.status }}\">-</div></div><td class=\"odd\"><div class=\"unit-wrap\"><span class=\"icon icon-single icon-34x34-unit-trebuchet\"></span></div><div><div class=\"box-time-sub time-attack {{ travelTimes.attack.trebuchet.status }}\">{{ travelTimes.attack.trebuchet.travelTime }}</div><div class=\"box-time-sub time-support {{ travelTimes.support.trebuchet.status }}\">{{ travelTimes.support.trebuchet.travelTime }}</div><div ng-if=\"relocateEnabled\" class=\"box-time-sub time-relocate {{ travelTimes.relocate.trebuchet.status }}\">{{ travelTimes.relocate.trebuchet.travelTime }}</div></div></table></div><h5 class=\"twx-section\">{{ 'units' | i18n:loc.ale:'common' }}</h5><table class=\"tbl-border-light tbl-striped\"><col width=\"25%\"><col width=\"25%\"><col width=\"25%\"><col width=\"25%\"><tbody class=\"add-units\"><tr><td colspan=\"4\" class=\"actions\"><ul class=\"list-btn list-center\"><li><div select=\"\" list=\"presets\" selected=\"selectedInsertPreset\" drop-down=\"true\"></div><li><a class=\"clear-units btn btn-orange\" ng-click=\"cleanUnitInputs()\">{{ 'add_clear' | i18n:loc.ale:'command_queue' }}</a></ul><tr ng-repeat=\"i in [] | range:(unitOrder.length / 4);\"><td><span class=\"icon-bg-black\" ng-class=\"'icon-34x34-unit-' + unitOrder[i * 4]\" tooltip=\"\" tooltip-content=\"{{ unitOrder[i * 4] | i18n:loc.ale:'unit_names' }}\"></span> <input remove-zero=\"\" ng-model=\"commandData.units[unitOrder[i * 4]]\" maxlength=\"5\" placeholder=\"{{ commandData.units[unitOrder[i * 4]] }}\" ng-focus=\"onUnitInputFocus(unitOrder[i * 4])\" ng-blur=\"onUnitInputBlur(unitOrder[i * 4])\"><td><span class=\"icon-bg-black\" ng-class=\"'icon-34x34-unit-' + unitOrder[i * 4 + 1]\" tooltip=\"\" tooltip-content=\"{{ unitOrder[i * 4 + 1] | i18n:loc.ale:'unit_names' }}\"></span> <input remove-zero=\"\" ng-model=\"commandData.units[unitOrder[i * 4 + 1]]\" maxlength=\"5\" placeholder=\"{{ commandData.units[unitOrder[i * 4 + 1]] }}\" ng-focus=\"onUnitInputFocus(unitOrder[i * 4 + 1])\" ng-blur=\"onUnitInputBlur(unitOrder[i * 4 + 1])\"><td><span class=\"icon-bg-black\" ng-class=\"'icon-34x34-unit-' + unitOrder[i * 4 + 2]\" tooltip=\"\" tooltip-content=\"{{ unitOrder[i * 4 + 2] | i18n:loc.ale:'unit_names' }}\"></span> <input remove-zero=\"\" ng-model=\"commandData.units[unitOrder[i * 4 + 2]]\" maxlength=\"5\" placeholder=\"{{ commandData.units[unitOrder[i * 4 + 2]] }}\" ng-focus=\"onUnitInputFocus(unitOrder[i * 4 + 2])\" ng-blur=\"onUnitInputBlur(unitOrder[i * 4 + 2])\"><td><span class=\"icon-bg-black\" ng-class=\"'icon-34x34-unit-' + unitOrder[i * 4 + 3]\" tooltip=\"\" tooltip-content=\"{{ unitOrder[i * 4 + 3] | i18n:loc.ale:'unit_names' }}\"></span> <input remove-zero=\"\" ng-model=\"commandData.units[unitOrder[i * 4 + 3]]\" maxlength=\"5\" placeholder=\"{{ commandData.units[unitOrder[i * 4 + 3]] }}\" ng-focus=\"onUnitInputFocus(unitOrder[i * 4 + 3])\" ng-blur=\"onUnitInputBlur(unitOrder[i * 4 + 3])\"><tr><td><span class=\"icon-bg-black icon-34x34-unit-catapult\" tooltip=\"\" tooltip-content=\"{{ 'catapult' | i18n:loc.ale:'unit_names' }}\"></span> <input remove-zero=\"\" ng-model=\"commandData.units.catapult\" maxlength=\"5\" placeholder=\"{{ commandData.units.catapult }}\" ng-keyup=\"catapultTargetVisibility()\" ng-focus=\"onUnitInputFocus('catapult')\" ng-blur=\"onUnitInputBlur('catapult')\"><td colspan=\"3\"><div ng-visible=\"showCatapultSelect\"><div class=\"unit-border box-slider\"><div class=\"height-wrapper\"><div select=\"\" list=\"attackableBuildings\" selected=\"catapultTarget\"></div></div></div></div></table><h5 class=\"twx-section\">{{ 'officers' | i18n:loc.ale:'common' }}</h5><table class=\"add-officers margin-top tbl-border-light tbl-officers\"><tr><td class=\"cell-officers\" ng-repeat=\"officer in officers\"><table class=\"tbl-border-dark tbl-officer\"><tr><td class=\"cell-space\"><span class=\"icon-44x44-premium_officer_{{ officer }}\"></span><td class=\"cell-officer-switch\" rowspan=\"2\"><div switch-slider=\"\" enabled=\"true\" value=\"commandData.officers[officer]\" vertical=\"true\" size=\"'34x66'\"></div><tr><td tooltip=\"\" tooltip-content=\"{{ 'available_officers' | i18n:loc.ale:'modal_preset_edit' }}\"><div class=\"amount\">{{ inventory.getItemAmountByType('premium_officer_' + officer) | number }}</div></table></table></form></div><div class=\"waiting rich-text\" ng-show=\"selectedTab === TAB_TYPES.WAITING\"><div class=\"filters\"><table class=\"tbl-border-light\"><tr><td><div ng-class=\"{'active': activeFilters[FILTER_TYPES.SELECTED_VILLAGE]}\" ng-click=\"toggleFilter(FILTER_TYPES.SELECTED_VILLAGE)\" class=\"box-border-dark icon selectedVillage\" tooltip=\"\" tooltip-content=\"{{ 'filters_selected_village' | i18n:loc.ale:'command_queue' }}\"><span class=\"icon-34x34-village-info icon-bg-black\"></span></div><div ng-class=\"{'active': activeFilters[FILTER_TYPES.BARBARIAN_TARGET]}\" ng-click=\"toggleFilter(FILTER_TYPES.BARBARIAN_TARGET)\" class=\"box-border-dark icon barbarianTarget\" tooltip=\"\" tooltip-content=\"{{ 'filters_barbarian_target' | i18n:loc.ale:'command_queue' }}\"><span class=\"icon-34x34-barbarian-village icon-bg-black\"></span></div><div ng-class=\"{'active': activeFilters[FILTER_TYPES.ATTACK]}\" ng-click=\"toggleFilter(FILTER_TYPES.ATTACK, true)\" class=\"box-border-dark icon allowedTypes\" tooltip=\"\" tooltip-content=\"{{ 'filters_attack' | i18n:loc.ale:'command_queue' }}\"><span class=\"icon-34x34-attack icon-bg-black\"></span></div><div ng-class=\"{'active': activeFilters[FILTER_TYPES.SUPPORT]}\" ng-click=\"toggleFilter(FILTER_TYPES.SUPPORT, true)\" class=\"box-border-dark icon allowedTypes\" tooltip=\"\" tooltip-content=\"{{ 'filters_support' | i18n:loc.ale:'command_queue' }}\"><span class=\"icon-34x34-support icon-bg-black\"></span></div><div ng-if=\"relocateEnabled\" ng-class=\"{'active': activeFilters[FILTER_TYPES.RELOCATE]}\" ng-click=\"toggleFilter(FILTER_TYPES.RELOCATE, true)\" class=\"box-border-dark icon allowedTypes\" tooltip=\"\" tooltip-content=\"{{ 'filters_relocate' | i18n:loc.ale:'command_queue' }}\"><span class=\"icon-34x34-relocate icon-bg-black\"></span></div><div class=\"text\"><input ng-model=\"filtersData[FILTER_TYPES.TEXT_MATCH]\" class=\"box-border-dark\" placeholder=\"{{ 'filters_text_match' | i18n:loc.ale:'command_queue' }}\"></div></table></div><div class=\"queue\"><h5 class=\"twx-section\">{{ 'queue_waiting' | i18n:loc.ale:'command_queue' }}</h5><p class=\"text-center\" ng-show=\"!visibleWaitingCommands.length\">{{ 'queue_none_added' | i18n:loc.ale:'command_queue' }}<table class=\"tbl-border-light\" ng-repeat=\"command in visibleWaitingCommands\"><col width=\"100px\"><tr><th colspan=\"2\"><span ng-class=\"{true: 'icon-bg-red', false:'icon-bg-blue'}[command.type === COMMAND_TYPES.ATTACK]\" class=\"icon-26x26-{{ command.type }}\" tooltip=\"\" tooltip-content=\"{{ command.type | i18n:loc.ale:'common' }}\"></span> <span class=\"size-26x26 icon-bg-black icon-26x26-time-duration\" tooltip=\"\" tooltip-content=\"{{ 'command_time_left' | i18n:loc.ale:'command_queue' }}\"></span> <span class=\"time-left\">{{ command.countdown | readableMillisecondsFilter }}</span> <span class=\"size-26x26 icon-bg-black icon-20x20-units-outgoing\" tooltip=\"\" tooltip-content=\"{{ 'command_out' | i18n:loc.ale:'command_queue' }}\"></span> <span class=\"sent-time\">{{ command.sendTime | readableDateFilter:loc.ale }}</span> <span class=\"size-26x26 icon-bg-black icon-20x20-time-arrival\" tooltip=\"\" tooltip-content=\"{{ 'command_arrive' | i18n:loc.ale:'command_queue' }}\"></span> <span class=\"arrive-time\">{{ command.arriveTime | readableDateFilter:loc.ale }}</span> <a href=\"#\" class=\"remove-command size-20x20 btn-red icon-20x20-close\" ng-click=\"removeCommand(command, EVENT_CODES.COMMAND_REMOVED)\" tooltip=\"\" tooltip-content=\"{{ 'queue_remove' | i18n:loc.ale:'command_queue' }}\"></a><tr><td>{{ 'villages' | i18n:loc.ale:'common' }}<td><a class=\"origin\"><span class=\"village-link img-link icon-20x20-village btn btn-orange padded\" ng-click=\"openVillageInfo(command.origin.id)\">{{ command.origin.name }} ({{ command.origin.x }}|{{ command.origin.y }})</span></a> <span class=\"size-20x20 icon-26x26-{{ command.type }}\"></span> <a class=\"target\"><span class=\"village-link img-link icon-20x20-village btn btn-orange padded\" ng-click=\"openVillageInfo(command.target.id)\">{{ command.target.name }} ({{ command.target.x }}|{{ command.target.y }})</span></a><tr><td>{{ 'units' | i18n:loc.ale:'common' }}<td class=\"units\"><div class=\"unit\" ng-repeat=\"(unit, amount) in command.units\"><span class=\"icon-34x34-unit-{{ unit }} icon\"></span> <span class=\"amount\">{{ amount }}</span> <span ng-if=\"unit === 'catapult' && command.type === COMMAND_TYPES.ATTACK\">({{ command.catapultTarget | i18n:loc.ale:'building_names' }})</span></div><div class=\"officer\" ng-repeat=\"(officer, enabled) in command.officers\"><span class=\"icon-34x34-premium_officer_{{ officer }}\"></span></div></table></div></div><div class=\"logs rich-text\" ng-show=\"selectedTab === TAB_TYPES.LOGS\"><h5 class=\"twx-section\">{{ 'queue_sent' | i18n:loc.ale:'command_queue' }}</h5><p class=\"text-center\" ng-show=\"!sentCommands.length\">{{ 'queue_none_sent' | i18n:loc.ale:'command_queue' }}<table class=\"tbl-border-light\" ng-repeat=\"command in sentCommands track by $index\"><col width=\"100px\"><tr><th colspan=\"2\"><span ng-class=\"{true: 'icon-bg-red', false:'icon-bg-blue'}[command.type === COMMAND_TYPES.ATTACK]\" class=\"icon-26x26-{{ command.type }}\" tooltip=\"\" tooltip-content=\"{{ command.type | i18n:loc.ale:'common' }}\"></span> <span class=\"size-26x26 icon-bg-black icon-20x20-units-outgoing\" tooltip=\"\" tooltip-content=\"{{ 'command_out' | i18n:loc.ale:'command_queue' }}\"></span> <span class=\"sent-time\">{{ command.sendTime | readableDateFilter:loc.ale }}</span> <span class=\"size-26x26 icon-bg-black icon-20x20-time-arrival\" tooltip=\"\" tooltip-content=\"{{ 'command_arrive' | i18n:loc.ale:'command_queue' }}\"></span> <span class=\"arrive-time\">{{ command.arriveTime | readableDateFilter:loc.ale }}</span><tr><td>{{ 'villages' | i18n:loc.ale:'common' }}<td><a class=\"origin\"><span class=\"village-link img-link icon-20x20-village btn btn-orange padded\" ng-click=\"openVillageInfo(command.origin.id)\">{{ command.origin.name }} ({{ command.origin.x }}|{{ command.origin.y }})</span></a> <span class=\"size-20x20 icon-26x26-{{ command.type }}\"></span> <a class=\"target\"><span class=\"village-link img-link icon-20x20-village btn btn-orange padded\" ng-click=\"openVillageInfo(command.target.id)\">{{ command.target.name }} ({{ command.target.x }}|{{ command.target.y }})</span></a><tr><td>{{ 'units' | i18n:loc.ale:'common' }}<td class=\"units\"><div class=\"unit\" ng-repeat=\"(unit, amount) in command.units\"><span class=\"icon-34x34-unit-{{ unit }} icon\"></span> <span class=\"amount\">{{ amount }}</span> <span ng-if=\"unit === 'catapult' && command.type === COMMAND_TYPES.ATTACK\">({{ command.catapultTarget | i18n:loc.ale:'common' }})</span></div><div class=\"officer\" ng-repeat=\"(officer, enabled) in command.officers\"><span class=\"icon-34x34-premium_officer_{{ officer }}\"></span></div></table><h5 class=\"twx-section\">{{ 'queue_expired' | i18n:loc.ale:'command_queue' }}</h5><p class=\"text-center\" ng-show=\"!expiredCommands.length\">{{ 'queue_none_expired' | i18n:loc.ale:'command_queue' }}<table class=\"tbl-border-light\" ng-repeat=\"command in expiredCommands track by $index\"><col width=\"100px\"><tr><th colspan=\"2\"><span ng-class=\"{true: 'icon-bg-red', false:'icon-bg-blue'}[command.type === COMMAND_TYPES.ATTACK]\" class=\"icon-26x26-{{ command.type }}\" tooltip=\"\" tooltip-content=\"{{ command.type | i18n:loc.ale:'common' }}\"></span> <span class=\"size-26x26 icon-bg-black icon-20x20-units-outgoing\" tooltip=\"\" tooltip-content=\"{{ 'command_out' | i18n:loc.ale:'command_queue' }}\"></span> <span class=\"sent-time\">{{ command.sendTime | readableDateFilter:loc.ale }}</span> <span class=\"size-26x26 icon-bg-black icon-20x20-time-arrival\" tooltip=\"\" tooltip-content=\"{{ 'command_arrive' | i18n:loc.ale:'command_queue' }}\"></span> <span class=\"arrive-time\">{{ command.arriveTime | readableDateFilter:loc.ale }}</span><tr><td>{{ 'villages' | i18n:loc.ale:'common' }}<td><a class=\"origin\"><span class=\"village-link img-link icon-20x20-village btn btn-orange padded\" ng-click=\"openVillageInfo(command.origin.id)\">{{ command.origin.name }} ({{ command.origin.x }}|{{ command.origin.y }})</span></a> <span class=\"size-20x20 icon-26x26-{{ command.type }}\"></span> <a class=\"target\"><span class=\"village-link img-link icon-20x20-village btn btn-orange padded\" ng-click=\"openVillageInfo(command.target.id)\">{{ command.target.name }} ({{ command.target.x }}|{{ command.target.y }})</span></a><tr><td>{{ 'units' | i18n:loc.ale:'common' }}<td class=\"units\"><div class=\"unit\" ng-repeat=\"(unit, amount) in command.units\"><span class=\"icon-34x34-unit-{{ unit }} icon\"></span> <span class=\"amount\">{{ amount }}</span> <span ng-if=\"unit === 'catapult' && command.type === COMMAND_TYPES.ATTACK\">({{ command.catapultTarget | i18n:loc.ale:'common' }})</span></div><div class=\"officer\" ng-repeat=\"(officer, enabled) in command.officers\"><span class=\"icon-34x34-premium_officer_{{ officer }}\"></span></div></table></div></div></div></div><footer class=\"win-foot\"><ul class=\"list-btn list-center\"><li ng-show=\"selectedTab === TAB_TYPES.LOGS\"><a class=\"btn-orange btn-border\" ng-click=\"clearRegisters()\">{{ 'general_clear' | i18n:loc.ale:'command_queue' }}</a><li ng-show=\"selectedTab === TAB_TYPES.ADD\"><a class=\"btn-orange btn-border add\" ng-click=\"addCommand(COMMAND_TYPES.ATTACK)\"><span class=\"icon-26x26-attack-small\"></span> {{ COMMAND_TYPES.ATTACK | i18n:loc.ale:'common' }}</a><li ng-show=\"selectedTab === TAB_TYPES.ADD\"><a class=\"btn-orange btn-border add\" ng-click=\"addCommand(COMMAND_TYPES.SUPPORT)\"><span class=\"icon-26x26-support\"></span> {{ COMMAND_TYPES.SUPPORT | i18n:loc.ale:'common' }}</a><li ng-show=\"relocateEnabled && selectedTab === TAB_TYPES.ADD\"><a class=\"btn-orange btn-border add\" ng-click=\"addCommand(COMMAND_TYPES.RELOCATE)\"><span class=\"icon-26x26-relocate\"></span> {{ COMMAND_TYPES.RELOCATE | i18n:loc.ale:'common' }}</a><li><a href=\"#\" ng-class=\"{false:'btn-green', true:'btn-red'}[running]\" class=\"btn-border\" ng-click=\"switchCommandQueue()\"><span ng-show=\"running\">{{ 'deactivate' | i18n:loc.ale:'common' }}</span> <span ng-show=\"!running\">{{ 'activate' | i18n:loc.ale:'common' }}</span></a></ul></footer></div>`)
        interfaceOverflow.addStyle('#two-command-queue input.unit{width:80px;height:34px}#two-command-queue form .padded{padding:2px 8px}#two-command-queue .basic-config input{width:200px;height:28px;font-weight:bold;padding:1px 8px 0 8px;outline:none;border:none;color:#000;resize:none}#two-command-queue span.select-wrapper{height:27px}#two-command-queue span.select-wrapper a.select-button{height:23px}#two-command-queue span.select-wrapper a.select-handler{-webkit-box-shadow:none;box-shadow:none;height:23px;line-height:23px;margin-bottom:-1px}#two-command-queue .custom-select{width:240px}#two-command-queue .originVillage,#two-command-queue .targetVillage{padding:0 7px}#two-command-queue a.btn{height:28px;line-height:28px;padding:0 10px}#two-command-queue .actions{text-align:center;user-select:none}#two-command-queue .command-village{padding-left:5px;padding-right:5px}#two-command-queue .add-units td{padding:2px 0;text-align:center}#two-command-queue .add-units .unit-icon{top:-1px}#two-command-queue .add-units span[class*="icon-34x34"]{margin-top:-2px !important}#two-command-queue .add-units input{height:34px;color:#fff3d0;border:none;outline:none;font-size:14px;background:url(data:image/png;base64,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) top left #b89064;box-shadow:inset 0 0 0 1px #000,inset 0 0 0 2px #a2682c,inset 0 0 0 3px #000,inset -3px -3px 2px 0 #fff,inset 0 0 9px 5px rgba(99,54,0,0.5);text-align:center;width:80px}#two-command-queue .add-officers .cell-officers{padding:7px 11px 5px 11px}#two-command-queue .add-officers .amount{color:#fff;text-align:center}#two-command-queue .command{margin-bottom:10px}#two-command-queue .command .time-left{width:93px;display:inline-block;padding:0 0 0 3px}#two-command-queue .command .sent-time,#two-command-queue .command .arrive-time{width:160px;display:inline-block;padding:0 0 0 5px}#two-command-queue .command td{padding:3px 6px}#two-command-queue .officers td{width:111px;text-align:center}#two-command-queue .officers label{margin-left:5px}#two-command-queue .officers span{margin-left:2px}#two-command-queue .units div.unit{float:left}#two-command-queue .units div.unit span.icon{transform:scale(.7);width:25px;height:25px}#two-command-queue .units div.unit span.amount{vertical-align:-2px;margin:0 5px 0 2px}#two-command-queue .units div.officer{float:left;margin:0 2px}#two-command-queue .units div.officer span{transform:scale(.7);width:25px;height:25px}#two-command-queue .remove-command{float:right;margin-top:3px}#two-command-queue .tbl-units td{text-align:center}#two-command-queue .tbl-speed{margin-top:10px}#two-command-queue .tbl-speed th{text-align:center}#two-command-queue .tbl-speed td{font-size:12px}#two-command-queue .tbl-speed .box-time-sub-icon{position:relative}#two-command-queue .tbl-speed .box-time-sub-icon .time-icon{position:absolute;top:-3px;left:27px;transform:scale(.7)}#two-command-queue .tbl-speed .box-time-sub-icon.time-relocate .time-icon{top:-6px;left:26px}#two-command-queue .tbl-speed .valid{color:#16600a}#two-command-queue .tbl-speed .invalid{color:#a1251f}#two-command-queue .tbl-speed .neutral{color:#000}#two-command-queue .dateType{width:200px}#two-command-queue .dateType .custom-select-handler{text-align:left}#two-command-queue .filters .icon{width:38px;float:left;margin:0 6px}#two-command-queue .filters .icon.active:before{box-shadow:0 0 0 1px #000,-1px -1px 0 2px #ac9c44,0 0 0 3px #ac9c44,0 0 0 4px #000;border-radius:1px;content:"";position:absolute;width:38px;height:38px;left:-1px;top:-1px}#two-command-queue .filters .text{margin-left:262px}#two-command-queue .filters .text input{height:36px;margin-top:1px;width:100%;text-align:left;padding:0 5px}#two-command-queue .filters .text input::placeholder{color:white}#two-command-queue .filters .text input:focus::placeholder{color:transparent}#two-command-queue .filters td{padding:6px}#two-command-queue .icon-34x34-barbarian-village:before{filter:grayscale(100%);background-image:url(https://i.imgur.com/ozI4k0h.png);background-position:-220px -906px}#two-command-queue .icon-20x20-time-arrival:before{transform:scale(.8);background-image:url(https://i.imgur.com/ozI4k0h.png);background-position:-529px -454px}#two-command-queue .icon-20x20-attack:before{transform:scale(.8);background-image:url(https://i.imgur.com/ozI4k0h.png);background-position:-546px -1086px;width:26px;height:26px}#two-command-queue .icon-20x20-support:before{transform:scale(.8);background-image:url(https://i.imgur.com/ozI4k0h.png);background-position:-462px -360px;width:26px;height:26px}#two-command-queue .icon-20x20-relocate:before{transform:scale(.8);background-image:url(https://i.imgur.com/ozI4k0h.png);background-position:-1090px -130px;width:26px;height:26px}#two-command-queue .icon-26x26-attack:before{background-image:url(https://i.imgur.com/ozI4k0h.png);background-position:-546px -1086px}')
    }

    const buildWindow = function () {
        const lastDateType = Lockr.get(STORAGE_KEYS.LAST_DATE_TYPE, DATE_TYPES.OUT, true)

        $scope = $rootScope.$new()
        $scope.selectedTab = DEFAULT_TAB
        $scope.inventory = modelDataService.getInventory()
        $scope.presets = utils.obj2selectOptions(presetList.getPresets())
        $scope.travelTimes = {}

        utils.each(COMMAND_TYPES, function (commandType) {
            $scope.travelTimes[commandType] = {}

            utils.each(travelTimeArmy, function (army, unit) {
                $scope.travelTimes[commandType][unit] = { travelTime: 0, status: 'neutral' }
            })
        })

        $scope.unitOrder = unitOrder
        $scope.officers = $gameData.getOrderedOfficerNames()
        $scope.searchQuery = {
            origin: '',
            target: ''
        }
        $scope.isValidDate = false
        $scope.dateTypes = util.toActionList(DATE_TYPES, function (actionType) {
            return $filter('i18n')(actionType, $rootScope.loc.ale, 'command_queue')
        })
        $scope.selectedDateType = {
            name: $filter('i18n')(lastDateType, $rootScope.loc.ale, 'command_queue'),
            value: lastDateType
        }
        $scope.selectedInsertPreset = {
            name: $filter('i18n')('add_insert_preset', $rootScope.loc.ale, 'command_queue'),
            value: null
        }
        $scope.catapultTarget = {
            name: $filter('i18n')(DEFAULT_CATAPULT_TARGET, $rootScope.loc.ale, 'building_names'),
            value: DEFAULT_CATAPULT_TARGET
        }
        $scope.autoCompleteOrigin = {
            type: ['village'],
            placeholder: $filter('i18n')('add_village_search', $rootScope.loc.ale, 'command_queue'),
            onEnter: eventHandlers.onAutoCompleteOrigin,
            tooltip: $filter('i18n')('add_origin', $rootScope.loc.ale, 'command_queue'),
            dropDown: true
        }
        $scope.autoCompleteTarget = {
            type: ['village'],
            placeholder: $filter('i18n')('add_village_search', $rootScope.loc.ale, 'command_queue'),
            onEnter: eventHandlers.onAutoCompleteTarget,
            tooltip: $filter('i18n')('add_target', $rootScope.loc.ale, 'command_queue'),
            dropDown: true
        }
        $scope.showCatapultSelect = !!commandData.units.catapult
        $scope.attackableBuildings = attackableBuildingsList
        $scope.commandData = commandData
        $scope.activeFilters = activeFilters
        $scope.filtersData = filtersData
        $scope.running = commandQueue.isRunning()
        $scope.waitingCommands = commandQueue.getWaitingCommands()
        $scope.visibleWaitingCommands = commandQueue.getWaitingCommands()
        $scope.sentCommands = commandQueue.getSentCommands()
        $scope.expiredCommands = commandQueue.getExpiredCommands()
        $scope.EVENT_CODES = EVENT_CODES
        $scope.FILTER_TYPES = FILTER_TYPES
        $scope.TAB_TYPES = TAB_TYPES
        $scope.COMMAND_TYPES = COMMAND_TYPES
        $scope.relocateEnabled = modelDataService.getWorldConfig().isRelocateUnitsEnabled()

        // functions
        $scope.onUnitInputFocus = onUnitInputFocus
        $scope.onUnitInputBlur = onUnitInputBlur
        $scope.catapultTargetVisibility = catapultTargetVisibility
        $scope.selectTab = selectTab
        $scope.addSelected = addSelected
        $scope.addMapSelected = addMapSelected
        $scope.addCurrentDate = addCurrentDate
        $scope.incrementDate = incrementDate
        $scope.reduceDate = reduceDate
        $scope.cleanUnitInputs = cleanUnitInputs
        $scope.addCommand = addCommand
        $scope.clearRegisters = clearRegisters
        $scope.switchCommandQueue = switchCommandQueue
        $scope.removeCommand = commandQueue.removeCommand
        $scope.openVillageInfo = windowDisplayService.openVillageInfo
        $scope.toggleFilter = toggleFilter

        $scope.$watch('commandData.origin', updateTravelTimes)
        $scope.$watch('commandData.target', updateTravelTimes)
        $scope.$watch('commandData.date', updateTravelTimes)
        $scope.$watch('commandData.officers', updateTravelTimes)
        $scope.$watch('selectedDateType.value', updateDateType)
        $scope.$watch('selectedInsertPreset.value', insertPreset)
        $scope.$watch('catapultTarget.value', updateCatapultTarget)
        $scope.$watch('filtersData[FILTER_TYPES.TEXT_MATCH]', textMatchFilter)

        let travelTimesTimer

        $scope.$watch('selectedTab', function () {
            if ($scope.selectedTab === TAB_TYPES.ADD) {
                travelTimesTimer = setInterval(function () {
                    updateTravelTimes()
                }, 2500)
            } else {
                clearInterval(travelTimesTimer)
            }
        })
        
        $scope.waitingCommands.forEach((command) => {
            setupCountdownForCommand(command)
        })

        let eventScope = new EventScope('twoverflow_queue_window', function () {
            clearInterval(travelTimesTimer)
            eventHandlers.clearCountdownUpdates()
        })

        eventScope.register(eventTypeProvider.ARMY_PRESET_UPDATE, eventHandlers.updatePresets, true)
        eventScope.register(eventTypeProvider.ARMY_PRESET_DELETED, eventHandlers.updatePresets, true)
        eventScope.register(eventTypeProvider.SELECT_SELECTED, eventHandlers.autoCompleteSelected, true)
        eventScope.register(eventTypeProvider.COMMAND_QUEUE_REMOVE, eventHandlers.removeCommand)
        eventScope.register(eventTypeProvider.COMMAND_QUEUE_REMOVE_ERROR, eventHandlers.removeError)
        eventScope.register(eventTypeProvider.COMMAND_QUEUE_SEND_TIME_LIMIT, eventHandlers.sendTimeLimit)
        eventScope.register(eventTypeProvider.COMMAND_QUEUE_SEND_NOT_OWN_VILLAGE, eventHandlers.sendNotOwnVillage)
        eventScope.register(eventTypeProvider.COMMAND_QUEUE_SEND_NO_UNITS_ENOUGH, eventHandlers.sendNoUnitsEnough)
        eventScope.register(eventTypeProvider.COMMAND_QUEUE_SEND, eventHandlers.sendCommand)
        eventScope.register(eventTypeProvider.COMMAND_QUEUE_START, eventHandlers.start)
        eventScope.register(eventTypeProvider.COMMAND_QUEUE_STOP, eventHandlers.stop)

        windowManagerService.getScreenWithInjectedScope('!twoverflow_queue_window', $scope)
    }

    return init
})

define('two/commandQueue/storageKeys', [], function () {
    return {
        QUEUE_COMMANDS: 'command_queue_commands',
        QUEUE_SENT: 'command_queue_sent',
        QUEUE_EXPIRED: 'command_queue_expired',
        LAST_DATE_TYPE: 'command_queue_last_date_type'
    }
})

define('two/commandQueue/types/commands', [], function () {
    return {
        'ATTACK': 'attack',
        'SUPPORT': 'support',
        'RELOCATE': 'relocate'
    }
})

define('two/commandQueue/types/dates', [], function () {
    return {
        ARRIVE: 'date_type_arrive',
        OUT: 'date_type_out'
    }
})

define('two/commandQueue/types/events', [], function () {
    return {
        NOT_OWN_VILLAGE: 'not_own_village',
        NOT_ENOUGH_UNITS: 'not_enough_units',
        TIME_LIMIT: 'time_limit',
        COMMAND_REMOVED: 'command_removed',
        COMMAND_SENT: 'command_sent'
    }
})

define('two/commandQueue/types/filters', [], function () {
    return {
        SELECTED_VILLAGE: 'selected_village',
        BARBARIAN_TARGET: 'barbarian_target',
        ALLOWED_TYPES: 'allowed_types',
        ATTACK: 'attack',
        SUPPORT: 'support',
        RELOCATE: 'relocate',
        TEXT_MATCH: 'text_match'
    }
})

define('two/commandQueue/errorCodes', [], function () {
    return {
        INVALID_ORIGIN: 'invalid_origin',
        INVALID_TARGET: 'invalid_target',
        INVALID_DATE: 'invalid_date',
        NO_UNITS: 'no_units',
        ALREADY_SENT: 'already_sent',
        RELOCATE_DISABLED: 'relocate_disabled',
        INVALID_DATE_TYPE: 'invalid_date_type',
        INVALID_OFFICER: 'invalid_officer',
        INVALID_COMMAND_TYPE: 'invalid_command_type',
        INVALID_CATAPULT_TARGET: 'invalid_catapult_target',
        INVALID_UNIT_TYPE: 'invalid_unit_type',
        INVALID_OFFICER_TYPE: 'invalid_officer_type'
    }
})

require([
    'two/ready',
    'two/commandQueue',
    'two/commandQueue/ui',
    'two/commandQueue/events'
], function (
    ready,
    commandQueue,
    commandQueueInterface
) {
    if (commandQueue.initialized) {
        return false
    }

    ready(function () {
        commandQueue.init()
        commandQueueInterface()

        if (commandQueue.getWaitingCommands().length > 0) {
            commandQueue.start(true)
        }
    }, ['map', 'world_config'])
})

define('two/faithChecker', [
    'two/utils',
    'queues/EventQueue',
    'Lockr',
    'conf/buildingTypes',
    'conf/locationTypes'
], function(
    utils,
    eventQueue,
    Lockr,
    BUILDING_TYPES,
    LOCATION_TYPES
) {
    let initialized = false
    let running = false
    let getHighestGodsHouseLevel
    let getMoralBonus
    let requestVillageProvinceNeighbours
    let highestChapelLevel
    let bonus
	
    let chapelBlockade = 0
	
    getHighestGodsHouseLevel = function getHighestGodsHouseLevel(villages) {
        let villageIdx,
            highestLevel = 0,
            tmpLevel

        for (villageIdx = 0; villageIdx < villages.length; villageIdx++) {
            tmpLevel = villages[villageIdx].chapel || villages[villageIdx].church
            if (tmpLevel && (tmpLevel > highestLevel)) {
                highestLevel = tmpLevel
            }
        }
        return highestLevel
    }
	
    getMoralBonus = function getMoralBonus(level, opt_isChapel) {
        let bonusLookUp = modelDataService.getWorldConfig().getChurchBonus(),
            bonusFactor = 0
        if ((level < 0) || (!opt_isChapel && level > (bonusLookUp.length - 1))) {
            return 0
        }
        if (opt_isChapel) {
            bonusFactor = modelDataService.getWorldConfig().getChapelBonus()
        } else {
            bonusFactor = bonusLookUp[level]
        }
        return Math.floor(bonusFactor * 100)
    }
	
    requestVillageProvinceNeighbours = function requestVillageProvinceNeighbours(villageId, callback) {
        socketService.emit(routeProvider.VILLAGES_IN_PROVINCE, {
            'village_id': villageId
        }, callback)
    }

    function faithInfo() {
        let player = modelDataService.getSelectedCharacter()
        let villages = player.getVillageList()

        villages.forEach(function(village) {
            let villageid = village.data.villageId
            let isChapel = village.data.buildings.chapel.level
            let buildingQueue = village.buildingQueue.data.queue
            let resources = village.getResources()
            let computed = resources.getComputed()
            let food = computed.food
            let wood = computed.wood
            let clay = computed.clay
            let iron = computed.iron
            let villageFood = food.currentStock
            let villageWood = wood.currentStock
            let villageClay = clay.currentStock
            let villageIron = iron.currentStock
            let foodCost = [0, 5000]
            let woodCost = [160, 16000]
            let clayCost = [200, 20000]
            let ironCost = [50, 5000]
            if (isChapel == 1) {
                chapelBlockade = 1
            }

            requestVillageProvinceNeighbours(villageid, function(responseData) {
                highestChapelLevel = getHighestGodsHouseLevel(responseData.villages)
                bonus = getMoralBonus(highestChapelLevel, isChapel === 1)
                console.log(bonus)
                if (bonus == 50 && (buildingQueue === undefined || buildingQueue.length == 0)) {
                    if (chapelBlockade == 1) {
                        if (villageWood >= woodCost[1] && villageClay >= clayCost[1] && villageIron >= ironCost[1] && villageFood >= foodCost[1]) {
                            socketService.emit(routeProvider.VILLAGE_UPGRADE_BUILDING, {
                                building: 'church',
                                village_id: villageid,
                                location: LOCATION_TYPES.MASS_SCREEN,
                                premium: false
                            })
                            utils.notif('success', $filter('i18n')('church', $rootScope.loc.ale, 'faith_checker'))
                        } else {
                            utils.notif('error', $filter('i18n')('resources', $rootScope.loc.ale, 'faith_checker'))
                        }
                    } else {
                        if (villageWood >= woodCost[0] && villageClay >= clayCost[0] && villageIron >= ironCost[0] && villageFood >= foodCost[0]) {
                            socketService.emit(routeProvider.VILLAGE_UPGRADE_BUILDING, {
                                building: 'chapel',
                                village_id: villageid,
                                location: LOCATION_TYPES.MASS_SCREEN,
                                premium: false
                            })
                            utils.notif('success', $filter('i18n')('chapel', $rootScope.loc.ale, 'faith_checker'))
                        } else {
                            utils.notif('error', $filter('i18n')('resources', $rootScope.loc.ale, 'faith_checker'))
                        }
                    }
                } else if (bonus == 50 && buildingQueue) {
                    buildingQueue.forEach(function(queue) {
                        let faithMax = queue.building

                        if ((faithMax != 'chapel' || faithMax != 'church') && chapelBlockade == 0) {
                            if (villageWood >= woodCost[0] && villageClay >= clayCost[0] && villageIron >= ironCost[0] && villageFood >= foodCost[0]) {
                                socketService.emit(routeProvider.VILLAGE_UPGRADE_BUILDING, {
                                    building: 'chapel',
                                    village_id: villageid,
                                    location: LOCATION_TYPES.MASS_SCREEN,
                                    premium: false
                                })
                                utils.notif('success', $filter('i18n')('chapel', $rootScope.loc.ale, 'faith_checker'))
                            } else {
                                utils.notif('error', $filter('i18n')('resources', $rootScope.loc.ale, 'faith_checker'))
                            }
                        } else if ((faithMax != 'chapel' || faithMax != 'church') && chapelBlockade == 1) {
                            if (villageWood >= woodCost[1] && villageClay >= clayCost[1] && villageIron >= ironCost[1] && villageFood >= foodCost[1]) {
                                socketService.emit(routeProvider.VILLAGE_UPGRADE_BUILDING, {
                                    building: 'church',
                                    village_id: villageid,
                                    location: LOCATION_TYPES.MASS_SCREEN,
                                    premium: false
                                })
                                utils.notif('success', $filter('i18n')('church', $rootScope.loc.ale, 'faith_checker'))
                            } else {
                                utils.notif('error', $filter('i18n')('resources', $rootScope.loc.ale, 'faith_checker'))
                            }
                        }
                    })
                } else {
                    utils.notif('success', $filter('i18n')('full', $rootScope.loc.ale, 'faith_checker'))
                }
            })
        })
    }

    let faithChecker = {}
    faithChecker.init = function() {
        initialized = true
    }
    faithChecker.start = function() {
        eventQueue.trigger(eventTypeProvider.FAITH_CHECKER_STARTED)
        running = true
        faithInfo()
    }
    faithChecker.stop = function() {
        eventQueue.trigger(eventTypeProvider.FAITH_CHECKER_STOPPED)
        running = false
    }
    faithChecker.isRunning = function() {
        return running
    }
    faithChecker.isInitialized = function() {
        return initialized
    }
    return faithChecker
})
define('two/faithChecker/events', [], function () {
    angular.extend(eventTypeProvider, {
        FAITH_CHECKER_STARTED: 'faith_checker_started',
        FAITH_CHECKER_STOPPED: 'faith_checker_stopped'
    })
})

define('two/faithChecker/ui', [
    'two/ui',
    'two/faithChecker',
    'two/utils',
    'queues/EventQueue'
], function (
    interfaceOverflow,
    faithChecker,
    utils,
    eventQueue
) {
    let $button

    const init = function () {
        $button = interfaceOverflow.addMenuButton('Kapelan', 110, $filter('i18n')('description', $rootScope.loc.ale, 'faith_checker'))

        $button.addEventListener('click', function () {
            if (faithChecker.isRunning()) {
                faithChecker.stop()
                utils.notif('success', $filter('i18n')('deactivated', $rootScope.loc.ale, 'faith_checker'))
            } else {
                faithChecker.start()
                utils.notif('success', $filter('i18n')('activated', $rootScope.loc.ale, 'faith_checker'))
            }
        })

        eventQueue.register(eventTypeProvider.FAITH_CHECKER_STARTED, function () {
            $button.classList.remove('btn-orange')
            $button.classList.add('btn-red')
        })

        eventQueue.register(eventTypeProvider.FAITH_CHECKER_STOPPED, function () {
            $button.classList.remove('btn-red')
            $button.classList.add('btn-orange')
        })

        if (faithChecker.isRunning()) {
            eventQueue.trigger(eventTypeProvider.FAITH_CHECKER_STARTED)
        }

        return opener
    }

    return init
})

require([
    'two/ready',
    'two/faithChecker',
    'two/faithChecker/ui',
    'Lockr',
    'queues/EventQueue',
    'two/faithChecker/events'
], function(
    ready,
    faithChecker,
    faithCheckerInterface,
    Lockr,
    eventQueue
) {
    const STORAGE_KEYS = {
        ACTIVE: 'faith_checker_active'
    }
	
    if (faithChecker.isInitialized()) {
        return false
    }
    ready(function() {
        faithChecker.init()
        faithCheckerInterface()

        ready(function() {
            if (Lockr.get(STORAGE_KEYS.ACTIVE, false, true)) {
                faithChecker.start()
            }

            eventQueue.register(eventTypeProvider.FAITH_CHECKER_STARTED, function() {
                Lockr.set(STORAGE_KEYS.ACTIVE, true)
            })

            eventQueue.register(eventTypeProvider.FAITH_CHECKER_STOPPED, function() {
                Lockr.set(STORAGE_KEYS.ACTIVE, false)
            })
        }, ['initial_village'])
    })
})
define('two/fakeSender', [
    'two/Settings',
    'two/fakeSender/settings',
    'two/fakeSender/settings/map',
    'two/fakeSender/settings/updates',
    'two/fakeSender/types/type',
    'two/fakeSender/types/datetype',
    'two/fakeSender/types/units',
    'two/ready',
    'queues/EventQueue'
], function (
    Settings,
    SETTINGS,
    SETTINGS_MAP,
    UPDATES,
    FS_TYPE,
    FS_DATE,
    FS_UNIT,
    ready,
    eventQueue
) {
    let initialized = false
    let running = false
    let settings
    let fakeSenderSettings

    let selectedGroups = []
    let selectedGroupsP = []
    let selectedGroupsT = []
    let selectedGroupsG = []
    let selectedGroupsTarget = []

    const STORAGE_KEYS = {
        SETTINGS: 'fake_sender_settings'
    }
    const FAKE_UNIT = {
        [FS_UNIT.SPEAR]: 'spear',
        [FS_UNIT.SWORD]: 'sword',
        [FS_UNIT.AXE]: 'axe',
        [FS_UNIT.ARCHER]: 'archer',
        [FS_UNIT.LIGHT_CAVALRY]: 'light_cavalry',
        [FS_UNIT.MOUNTED_ARCHER]: 'mounted_archer',
        [FS_UNIT.HEAVT_CAVALRY]: 'heavy_cavalry',
        [FS_UNIT.RAM]: 'ram',
        [FS_UNIT.CATAPULT]: 'catapult',
        [FS_UNIT.TREBUCHET]: 'trebuchet',
        [FS_UNIT.DOPPELSOLDNER]: 'doppelsoldner',
        [FS_UNIT.SNOB]: 'snob',
        [FS_UNIT.KNIGHT]: 'knight'
    }
	
    const DATE_TYPE = {
        [FS_DATE.ARRIVE]: 'arrive',
        [FS_DATE.OUT]: 'out'
    }
	
    const FAKE_TYPE = {
        [FS_DATE.ATTACK]: 'attack',
        [FS_DATE.SUPPORT]: 'support',
        [FS_DATE.QUATTRO]: 'four',
        [FS_DATE.FULL]: 'full'
    }

    console.log(FAKE_UNIT, DATE_TYPE, FAKE_TYPE)

    const updateGroups = function () {
        selectedGroups = []
        selectedGroupsP = []
        selectedGroupsT = []
        selectedGroupsG = []
        selectedGroupsTarget = []

        const allGroups = modelDataService.getGroupList().getGroups()
        const groupsInVillagesFake = fakeSenderSettings[SETTINGS.GROUP]
        const groupsInPlayerFake = fakeSenderSettings[SETTINGS.GROUPP]
        const groupsInTribeFake = fakeSenderSettings[SETTINGS.GROUPT]
        const groupsInGroupFake = fakeSenderSettings[SETTINGS.GROUPG]
        const targetsGroups = fakeSenderSettings[SETTINGS.GROUP_TARGET]

        groupsInVillagesFake.forEach(function (groupId) {
            selectedGroups.push(allGroups[groupId])
        })
        groupsInPlayerFake.forEach(function (groupId) {
            selectedGroupsP.push(allGroups[groupId])
        })
        groupsInTribeFake.forEach(function (groupId) {
            selectedGroupsT.push(allGroups[groupId])
        })
        groupsInGroupFake.forEach(function (groupId) {
            selectedGroupsG.push(allGroups[groupId])
        })
        targetsGroups.forEach(function (groupId) {
            selectedGroupsTarget.push(allGroups[groupId])
        })
    }

    const fakeSender = {}

    fakeSender.init = function () {
        initialized = true

        settings = new Settings({
            settingsMap: SETTINGS_MAP,
            storageKey: STORAGE_KEYS.SETTINGS
        })

        settings.onChange(function (changes, updates) {
            fakeSenderSettings = settings.getAll()

            if (updates[UPDATES.GROUPS]) {
                updateGroups()
            }
        })

        fakeSenderSettings = settings.getAll()

        console.log('fakeSender settings', fakeSenderSettings)

        $rootScope.$on(eventTypeProvider.GROUPS_CREATED, updateGroups)
        $rootScope.$on(eventTypeProvider.GROUPS_DESTROYED, updateGroups)
        $rootScope.$on(eventTypeProvider.GROUPS_UPDATED, updateGroups)
    }

    fakeSender.start = function () {
        running = true

        eventQueue.trigger(eventTypeProvider.FAKE_SENDER_START)
    }

    fakeSender.stop = function () {
        running = false

        eventQueue.trigger(eventTypeProvider.FAKE_SENDER_STOP)
    }

    fakeSender.getSettings = function () {
        return settings
    }

    fakeSender.isInitialized = function () {
        return initialized
    }

    fakeSender.isRunning = function () {
        return running
    }

    return fakeSender
})

define('two/fakeSender/events', [], function () {
    angular.extend(eventTypeProvider, {
        FAKE_SENDER_START: 'fake_sender_start',
        FAKE_SENDER_STOP: 'fake_sender_stop'
    })
})

define('two/fakeSender/ui', [
    'two/ui',
    'two/fakeSender',
    'two/fakeSender/settings',
    'two/fakeSender/settings/map',
    'two/fakeSender/types/type',
    'two/fakeSender/types/datetype',
    'two/fakeSender/types/units',
    'two/Settings',
    'two/EventScope',
    'two/utils'
], function (
    interfaceOverflow,
    fakeSender,
    SETTINGS,
    SETTINGS_MAP,
    FS_TYPE,
    FS_DATE,
    FS_UNIT,
    Settings,
    EventScope,
    utils
) {
    let $scope
    let settings
    let groupList = modelDataService.getGroupList()
    let $button
    
    const TAB_TYPES = {
        FAKE: 'fake',
        LOGS: 'logs'
    }

    const selectTab = function (tabType) {
        $scope.selectedTab = tabType
    }

    const saveSettings = function () {
        settings.setAll(settings.decode($scope.settings))

        utils.notif('success', $filter('i18n')('general.saved', $rootScope.loc.ale, 'fake_sender'))
    }

    const switchState = function () {
        if (fakeSender.isRunning()) {
            fakeSender.stop()
        } else {
            fakeSender.start()
        }
    }

    const eventHandlers = {
        updateGroups: function () {
            $scope.groups = Settings.encodeList(groupList.getGroups(), {
                disabled: false,
                type: 'groups'
            })
        },
        start: function () {
            $scope.running = true

            $button.classList.remove('btn-orange')
            $button.classList.add('btn-red')
            utils.notif('success', $filter('i18n')('general.started', $rootScope.loc.ale, 'fake_sender'))
        },
        stop: function () {
            $scope.running = false

            $button.classList.remove('btn-red')
            $button.classList.add('btn-orange')
            utils.notif('success', $filter('i18n')('general.stopped', $rootScope.loc.ale, 'fake_sender'))
        }
    }

    const init = function () {
        settings = fakeSender.getSettings()
        interfaceOverflow.addDivisor(21)
        $button = interfaceOverflow.addMenuButton('Watażka', 20)
        $button.addEventListener('click', buildWindow)

        interfaceOverflow.addTemplate('twoverflow_fake_sender_window', `<div id=\"two-fake-sender\" class=\"win-content two-window\"><header class=\"win-head\"><h2>{{ 'title' | i18n:loc.ale:'fake_sender' }}</h2><ul class=\"list-btn\"><li><a href=\"#\" class=\"size-34x34 btn-red icon-26x26-close\" ng-click=\"closeWindow()\"></a></ul></header><div class=\"win-main\" scrollbar=\"\"><div class=\"tabs tabs-bg\"><div class=\"tabs-two-col\"><div class=\"tab\" ng-click=\"selectTab(TAB_TYPES.FAKE)\" ng-class=\"{'tab-active': selectedTab == TAB_TYPES.FAKE}\"><div class=\"tab-inner\"><div ng-class=\"{'box-border-light': selectedTab === TAB_TYPES.FAKE}\"><a href=\"#\" ng-class=\"{'btn-icon btn-orange': selectedTab !== TAB_TYPES.FAKE}\">{{ 'fake' | i18n:loc.ale:'fake_sender' }}</a></div></div></div><div class=\"tab\" ng-click=\"selectTab(TAB_TYPES.LOGS)\" ng-class=\"{'tab-active': selectedTab == TAB_TYPES.LOGS}\"><div class=\"tab-inner\"><div ng-class=\"{'box-border-light': selectedTab === TAB_TYPES.LOGS}\"><a href=\"#\" ng-class=\"{'btn-icon btn-orange': selectedTab !== TAB_TYPES.LOGS}\">{{ 'logs' | i18n:loc.ale:'fake_sender' }}</a></div></div></div></div></div><div class=\"box-paper footer\"><div class=\"scroll-wrap\"><div class=\"settings\" ng-show=\"selectedTab === TAB_TYPES.FAKE\"><h5 class=\"twx-section\">{{ 'send_villages' | i18n:loc.ale:'fake_sender' }}</h5><form class=\"addForm\"><table class=\"tbl-border-light tbl-striped\"><col width=\"30%\"><col width=\"5%\"><col><col width=\"18%\"><tr><td><div auto-complete=\"autoCompleteTarget\"></div><td class=\"text-center\"><span class=\"icon-26x26-rte-village\"></span><td ng-if=\"!commandData.origin\" class=\"command-village\">{{ 'add_no_village' | i18n:loc.ale:'fake_sender' }}<td ng-if=\"commandData.origin\" class=\"command-village\">{{ commandData.origin.name }} ({{ commandData.origin.x }}|{{ commandData.origin.y }})<td class=\"actions\"><a class=\"btn btn-orange\" ng-click=\"addMapSelected()\" tooltip=\"\" tooltip-content=\"{{ 'add_map_selected' | i18n:loc.ale:'fake_sender' }}\">{{ 'selected' | i18n:loc.ale:'common' }}</a><tr><td><div auto-complete=\"autoCompleteTarget\"></div><td class=\"text-center\"><span class=\"icon-26x26-rte-village\"></span><td ng-if=\"!commandData.origin\" class=\"command-village\">{{ 'add_no_village' | i18n:loc.ale:'fake_sender' }}<td ng-if=\"commandData.origin\" class=\"command-village\">{{ commandData.origin.name }} ({{ commandData.origin.x }}|{{ commandData.origin.y }})<td class=\"actions\"><a class=\"btn btn-orange\" ng-click=\"addMapSelected()\" tooltip=\"\" tooltip-content=\"{{ 'add_map_selected' | i18n:loc.ale:'fake_sender' }}\">{{ 'selected' | i18n:loc.ale:'common' }}</a><tr><td><div auto-complete=\"autoCompleteTarget\"></div><td class=\"text-center\"><span class=\"icon-26x26-rte-village\"></span><td ng-if=\"!commandData.origin\" class=\"command-village\">{{ 'add_no_village' | i18n:loc.ale:'fake_sender' }}<td ng-if=\"commandData.origin\" class=\"command-village\">{{ commandData.origin.name }} ({{ commandData.origin.x }}|{{ commandData.origin.y }})<td class=\"actions\"><a class=\"btn btn-orange\" ng-click=\"addMapSelected()\" tooltip=\"\" tooltip-content=\"{{ 'add_map_selected' | i18n:loc.ale:'fake_sender' }}\">{{ 'selected' | i18n:loc.ale:'common' }}</a><tr><td><div auto-complete=\"autoCompleteTarget\"></div><td class=\"text-center\"><span class=\"icon-26x26-rte-village\"></span><td ng-if=\"!commandData.origin\" class=\"command-village\">{{ 'add_no_village' | i18n:loc.ale:'fake_sender' }}<td ng-if=\"commandData.origin\" class=\"command-village\">{{ commandData.origin.name }} ({{ commandData.origin.x }}|{{ commandData.origin.y }})<td class=\"actions\"><a class=\"btn btn-orange\" ng-click=\"addMapSelected()\" tooltip=\"\" tooltip-content=\"{{ 'add_map_selected' | i18n:loc.ale:'fake_sender' }}\">{{ 'selected' | i18n:loc.ale:'common' }}</a><tr><td><div auto-complete=\"autoCompleteTarget\"></div><td class=\"text-center\"><span class=\"icon-26x26-rte-village\"></span><td ng-if=\"!commandData.origin\" class=\"command-village\">{{ 'add_no_village' | i18n:loc.ale:'fake_sender' }}<td ng-if=\"commandData.origin\" class=\"command-village\">{{ commandData.origin.name }} ({{ commandData.origin.x }}|{{ commandData.origin.y }})<td class=\"actions\"><a class=\"btn btn-orange\" ng-click=\"addMapSelected()\" tooltip=\"\" tooltip-content=\"{{ 'add_map_selected' | i18n:loc.ale:'fake_sender' }}\">{{ 'selected' | i18n:loc.ale:'common' }}</a><tr><td><div auto-complete=\"autoCompleteTarget\"></div><td class=\"text-center\"><span class=\"icon-26x26-rte-village\"></span><td ng-if=\"!commandData.origin\" class=\"command-village\">{{ 'add_no_village' | i18n:loc.ale:'fake_sender' }}<td ng-if=\"commandData.origin\" class=\"command-village\">{{ commandData.origin.name }} ({{ commandData.origin.x }}|{{ commandData.origin.y }})<td class=\"actions\"><a class=\"btn btn-orange\" ng-click=\"addMapSelected()\" tooltip=\"\" tooltip-content=\"{{ 'add_map_selected' | i18n:loc.ale:'fake_sender' }}\">{{ 'selected' | i18n:loc.ale:'common' }}</a><tr><td><div auto-complete=\"autoCompleteTarget\"></div><td class=\"text-center\"><span class=\"icon-26x26-rte-village\"></span><td ng-if=\"!commandData.origin\" class=\"command-village\">{{ 'add_no_village' | i18n:loc.ale:'fake_sender' }}<td ng-if=\"commandData.origin\" class=\"command-village\">{{ commandData.origin.name }} ({{ commandData.origin.x }}|{{ commandData.origin.y }})<td class=\"actions\"><a class=\"btn btn-orange\" ng-click=\"addMapSelected()\" tooltip=\"\" tooltip-content=\"{{ 'add_map_selected' | i18n:loc.ale:'fake_sender' }}\">{{ 'selected' | i18n:loc.ale:'common' }}</a><tr><td><div auto-complete=\"autoCompleteTarget\"></div><td class=\"text-center\"><span class=\"icon-26x26-rte-village\"></span><td ng-if=\"!commandData.origin\" class=\"command-village\">{{ 'add_no_village' | i18n:loc.ale:'fake_sender' }}<td ng-if=\"commandData.origin\" class=\"command-village\">{{ commandData.origin.name }} ({{ commandData.origin.x }}|{{ commandData.origin.y }})<td class=\"actions\"><a class=\"btn btn-orange\" ng-click=\"addMapSelected()\" tooltip=\"\" tooltip-content=\"{{ 'add_map_selected' | i18n:loc.ale:'fake_sender' }}\">{{ 'selected' | i18n:loc.ale:'common' }}</a><tr><td><div auto-complete=\"autoCompleteTarget\"></div><td class=\"text-center\"><span class=\"icon-26x26-rte-village\"></span><td ng-if=\"!commandData.origin\" class=\"command-village\">{{ 'add_no_village' | i18n:loc.ale:'fake_sender' }}<td ng-if=\"commandData.origin\" class=\"command-village\">{{ commandData.origin.name }} ({{ commandData.origin.x }}|{{ commandData.origin.y }})<td class=\"actions\"><a class=\"btn btn-orange\" ng-click=\"addMapSelected()\" tooltip=\"\" tooltip-content=\"{{ 'add_map_selected' | i18n:loc.ale:'fake_sender' }}\">{{ 'selected' | i18n:loc.ale:'common' }}</a><tr><td><div auto-complete=\"autoCompleteTarget\" placeholder=\"{{ 'add_village' | i18n:loc.ale:'fake_sender' }}\"></div><td class=\"text-center\"><span class=\"icon-26x26-rte-village\"></span><td ng-if=\"!commandData.origin\" class=\"command-village\">{{ 'add_no_village' | i18n:loc.ale:'fake_sender' }}<td ng-if=\"commandData.origin\" class=\"command-village\">{{ commandData.origin.name }} ({{ commandData.origin.x }}|{{ commandData.origin.y }})<td class=\"actions\"><a class=\"btn btn-orange\" ng-click=\"addMapSelected()\" tooltip=\"\" tooltip-content=\"{{ 'add_map_selected' | i18n:loc.ale:'fake_sender' }}\">{{ 'selected' | i18n:loc.ale:'common' }}</a><tr><td><input ng-model=\"commandData.date\" class=\"textfield-border date\" pattern=\"\\s*\\d{1,2}:\\d{1,2}:\\d{1,2}(:\\d{1,3})? \\d{1,2}\\/\\d{1,2}\\/\\d{4}\\s*\" placeholder=\"{{ 'add_date' | i18n:loc.ale:'fake_sender' }}\" tooltip=\"\" tooltip-content=\"hh:mm:ss:SSS dd/MM/yyyy\"><td class=\"text-center\"><span class=\"icon-26x26-time\"></span><td><div select=\"\" list=\"datetype\" selected=\"selectedDateType\" drop-down=\"true\"></div><td class=\"actions\"><a class=\"btn btn-orange\" ng-click=\"reduceDate()\" tooltip=\"\" tooltip-content=\"{{ 'add_current_date_minus' | i18n:loc.ale:'fake_sender' }}\">-</a><a class=\"btn btn-orange\" ng-click=\"addCurrentDate()\" tooltip=\"\" tooltip-content=\"{{ 'add_current_date' | i18n:loc.ale:'fake_sender' }}\">{{ 'now' | i18n:loc.ale:'common' }}</a><a class=\"btn btn-orange\" ng-click=\"incrementDate()\" tooltip=\"\" tooltip-content=\"{{ 'add_current_date_plus' | i18n:loc.ale:'fake_sender' }}\">+</a><tr><td colspan=\"2\"><span class=\"ff-cell-fix\">{{ 'group' | i18n:loc.ale:'fake_sender' }}</span><td colspan=\"2\"><div select=\"\" list=\"groups\" selected=\"settings[SETTINGS.GROUP]\" drop-down=\"true\"></div><tr><td colspan=\"2\"><span class=\"ff-cell-fix\">{{ 'unit' | i18n:loc.ale:'fake_sender' }}</span><td colspan=\"2\"><div select=\"\" list=\"units\" selected=\"settings[SETTINGS.UNIT]\" drop-down=\"true\"></div><tr><td colspan=\"2\"><span class=\"ff-cell-fix\">{{ 'type' | i18n:loc.ale:'fake_sender' }}</span><td colspan=\"2\"><div select=\"\" list=\"type\" selected=\"settings[SETTINGS.TYPE]\" drop-down=\"true\"></div></table><table class=\"tbl-border-light tbl-striped\"><col><col width=\"200px\"><col width=\"60px\"><tr><td><span class=\"ff-cell-fix\">{{ 'attack_interval' | i18n:loc.ale:'fake_sender' }}</span><td><div range-slider=\"\" min=\"settingsMap[SETTINGS.COMMAND_INTERVAL].min\" max=\"settingsMap[SETTINGS.COMMAND_INTERVAL].max\" value=\"settings[SETTINGS.COMMAND_INTERVAL]\" enabled=\"true\"></div><td class=\"cell-bottom\"><input class=\"fit textfield-border text-center\" ng-model=\"settings[SETTINGS.COMMAND_INTERVAL]\"><tr><td><span class=\"ff-cell-fix\">{{ 'own_limit' | i18n:loc.ale:'fake_sender' }}</span><td><div range-slider=\"\" min=\"settingsMap[SETTINGS.LIMIT_OWN].min\" max=\"settingsMap[SETTINGS.LIMIT_OWN].max\" value=\"settings[SETTINGS.LIMIT_OWN]\" enabled=\"true\"></div><td class=\"cell-bottom\"><input class=\"fit textfield-border text-center\" ng-model=\"settings[SETTINGS.LIMIT_OWN]\"><tr><td><span class=\"ff-cell-fix\">{{ 'target_limit' | i18n:loc.ale:'fake_sender' }}</span><td><div range-slider=\"\" min=\"settingsMap[SETTINGS.LIMIT_TARGET].min\" max=\"settingsMap[SETTINGS.LIMIT_TARGET].max\" value=\"settings[SETTINGS.LIMIT_TARGET]\" enabled=\"true\"></div><td class=\"cell-bottom\"><input class=\"fit textfield-border text-center\" ng-model=\"settings[SETTINGS.LIMIT_TARGET]\"><tr><td colspan=\"3\" class=\"item-send\"><span class=\"btn-green btn-border sendVillages\" tooltip=\"\" tooltip-content=\"{{ 'sending_villages' | i18n:loc.ale:'fake_sender' }}\">{{ 'send' | i18n:loc.ale:'fake_sender' }}</span></table></form><h5 class=\"twx-section\">{{ 'send_player' | i18n:loc.ale:'fake_sender' }}</h5><form class=\"addForm\"><table class=\"tbl-border-light tbl-striped\"><col width=\"30%\"><col width=\"5%\"><col><col width=\"18%\"><tr><td><div auto-complete=\"autoCompletePlayer\" placeholder=\"{{ 'add_player' | i18n:loc.ale:'fake_sender' }}\"></div><td class=\"text-center\"><span class=\"icon-26x26-rte-character\"></span><td ng-if=\"!commandData.origin\" class=\"command-village\">{{ 'add_no_player' | i18n:loc.ale:'fake_sender' }}<td ng-if=\"commandData.origin\" class=\"command-village\">{{ commandData.origin.name }} ({{ commandData.origin.x }}|{{ commandData.origin.y }})<td class=\"actions\"><a class=\"btn btn-orange\" ng-click=\"addMapSelected()\" tooltip=\"\" tooltip-content=\"{{ 'add_map_selected' | i18n:loc.ale:'fake_sender' }}\">{{ 'selected' | i18n:loc.ale:'common' }}</a><tr><td><input ng-model=\"commandData.date\" class=\"textfield-border date\" pattern=\"\\s*\\d{1,2}:\\d{1,2}:\\d{1,2}(:\\d{1,3})? \\d{1,2}\\/\\d{1,2}\\/\\d{4}\\s*\" placeholder=\"{{ 'add_date' | i18n:loc.ale:'fake_sender' }}\" tooltip=\"\" tooltip-content=\"hh:mm:ss:SSS dd/MM/yyyy\"><td class=\"text-center\"><span class=\"icon-26x26-time\"></span><td><div select=\"\" list=\"datetype\" selected=\"selectedDateType\" drop-down=\"true\"></div><td class=\"actions\"><a class=\"btn btn-orange\" ng-click=\"reduceDate()\" tooltip=\"\" tooltip-content=\"{{ 'add_current_date_minus' | i18n:loc.ale:'fake_sender' }}\">-</a><a class=\"btn btn-orange\" ng-click=\"addCurrentDate()\" tooltip=\"\" tooltip-content=\"{{ 'add_current_date' | i18n:loc.ale:'fake_sender' }}\">{{ 'now' | i18n:loc.ale:'common' }}</a><a class=\"btn btn-orange\" ng-click=\"incrementDate()\" tooltip=\"\" tooltip-content=\"{{ 'add_current_date_plus' | i18n:loc.ale:'fake_sender' }}\">+</a><tr><td colspan=\"2\"><span class=\"ff-cell-fix\">{{ 'group' | i18n:loc.ale:'fake_sender' }}</span><td colspan=\"2\"><div select=\"\" list=\"groups\" selected=\"settings[SETTINGS.GROUPP]\" drop-down=\"true\"></div><tr><td colspan=\"2\"><span class=\"ff-cell-fix\">{{ 'unit' | i18n:loc.ale:'fake_sender' }}</span><td colspan=\"2\"><div select=\"\" list=\"units\" selected=\"settings[SETTINGS.UNITP]\" drop-down=\"true\"></div><tr><td colspan=\"2\"><span class=\"ff-cell-fix\">{{ 'type' | i18n:loc.ale:'fake_sender' }}</span><td colspan=\"2\"><div select=\"\" list=\"type\" selected=\"settings[SETTINGS.TYPEP]\" drop-down=\"true\"></div></table><table class=\"tbl-border-light tbl-striped\"><col><col width=\"200px\"><col width=\"60px\"><tr><td><span class=\"ff-cell-fix\">{{ 'attack_interval' | i18n:loc.ale:'fake_sender' }}</span><td><div range-slider=\"\" min=\"settingsMap[SETTINGS.COMMAND_INTERVALP].min\" max=\"settingsMap[SETTINGS.COMMAND_INTERVALP].max\" value=\"settings[SETTINGS.COMMAND_INTERVALP]\" enabled=\"true\"></div><td class=\"cell-bottom\"><input class=\"fit textfield-border text-center\" ng-model=\"settings[SETTINGS.COMMAND_INTERVALP]\"><tr><td><span class=\"ff-cell-fix\">{{ 'own_limit' | i18n:loc.ale:'fake_sender' }}</span><td><div range-slider=\"\" min=\"settingsMap[SETTINGS.LIMIT_OWNP].min\" max=\"settingsMap[SETTINGS.LIMIT_OWNP].max\" value=\"settings[SETTINGS.LIMIT_OWNP]\" enabled=\"true\"></div><td class=\"cell-bottom\"><input class=\"fit textfield-border text-center\" ng-model=\"settings[SETTINGS.LIMIT_OWNP]\"><tr><td><span class=\"ff-cell-fix\">{{ 'target_limit' | i18n:loc.ale:'fake_sender' }}</span><td><div range-slider=\"\" min=\"settingsMap[SETTINGS.LIMIT_TARGETP].min\" max=\"settingsMap[SETTINGS.LIMIT_TARGETP].max\" value=\"settings[SETTINGS.LIMIT_TARGETP]\" enabled=\"true\"></div><td class=\"cell-bottom\"><input class=\"fit textfield-border text-center\" ng-model=\"settings[SETTINGS.LIMIT_TARGETP]\"><tr><td colspan=\"3\" class=\"item-send\"><span class=\"btn-green btn-border sendPlayer\" tooltip=\"\" tooltip-content=\"{{ 'sending_player' | i18n:loc.ale:'fake_sender' }}\">{{ 'send' | i18n:loc.ale:'fake_sender' }}</span></table></form><h5 class=\"twx-section\">{{ 'send_tribe' | i18n:loc.ale:'fake_sender' }}</h5><form class=\"addForm\"><table class=\"tbl-border-light tbl-striped\"><col width=\"30%\"><col width=\"5%\"><col><col width=\"18%\"><tr><td><div auto-complete=\"autoCompleteTribe\" placeholder=\"{{ 'add_tribe' | i18n:loc.ale:'fake_sender' }}\"></div><td class=\"text-center\"><span class=\"icon-26x26-rte-tribe\"></span><td ng-if=\"!commandData.origin\" class=\"command-village\">{{ 'add_no_tribe' | i18n:loc.ale:'fake_sender' }}<td ng-if=\"commandData.origin\" class=\"command-village\">{{ commandData.origin.name }} ({{ commandData.origin.x }}|{{ commandData.origin.y }})<td class=\"actions\"><a class=\"btn btn-orange\" ng-click=\"addMapSelected()\" tooltip=\"\" tooltip-content=\"{{ 'add_map_selected' | i18n:loc.ale:'fake_sender' }}\">{{ 'selected' | i18n:loc.ale:'common' }}</a><tr><td><input ng-model=\"commandData.date\" class=\"textfield-border date\" pattern=\"\\s*\\d{1,2}:\\d{1,2}:\\d{1,2}(:\\d{1,3})? \\d{1,2}\\/\\d{1,2}\\/\\d{4}\\s*\" placeholder=\"{{ 'add_date' | i18n:loc.ale:'fake_sender' }}\" tooltip=\"\" tooltip-content=\"hh:mm:ss:SSS dd/MM/yyyy\"><td class=\"text-center\"><span class=\"icon-26x26-time\"></span><td><div select=\"\" list=\"datetype\" selected=\"selectedDateType\" drop-down=\"true\"></div><td class=\"actions\"><a class=\"btn btn-orange\" ng-click=\"reduceDate()\" tooltip=\"\" tooltip-content=\"{{ 'add_current_date_minus' | i18n:loc.ale:'fake_sender' }}\">-</a><a class=\"btn btn-orange\" ng-click=\"addCurrentDate()\" tooltip=\"\" tooltip-content=\"{{ 'add_current_date' | i18n:loc.ale:'fake_sender' }}\">{{ 'now' | i18n:loc.ale:'common' }}</a><a class=\"btn btn-orange\" ng-click=\"incrementDate()\" tooltip=\"\" tooltip-content=\"{{ 'add_current_date_plus' | i18n:loc.ale:'fake_sender' }}\">+</a><tr><td colspan=\"2\"><span class=\"ff-cell-fix\">{{ 'group' | i18n:loc.ale:'fake_sender' }}</span><td colspan=\"2\"><div select=\"\" list=\"groups\" selected=\"settings[SETTINGS.GROUPT]\" drop-down=\"true\"></div><tr><td colspan=\"2\"><span class=\"ff-cell-fix\">{{ 'unit' | i18n:loc.ale:'fake_sender' }}</span><td colspan=\"2\"><div select=\"\" list=\"units\" selected=\"settings[SETTINGS.UNITT]\" drop-down=\"true\"></div><tr><td colspan=\"2\"><span class=\"ff-cell-fix\">{{ 'type' | i18n:loc.ale:'fake_sender' }}</span><td colspan=\"2\"><div select=\"\" list=\"type\" selected=\"settings[SETTINGS.TYPET]\" drop-down=\"true\"></div></table><table class=\"tbl-border-light tbl-striped\"><col><col width=\"200px\"><col width=\"60px\"><tr><td><span class=\"ff-cell-fix\">{{ 'attack_interval' | i18n:loc.ale:'fake_sender' }}</span><td><div range-slider=\"\" min=\"settingsMap[SETTINGS.COMMAND_INTERVALT].min\" max=\"settingsMap[SETTINGS.COMMAND_INTERVALT].max\" value=\"settings[SETTINGS.COMMAND_INTERVALT]\" enabled=\"true\"></div><td class=\"cell-bottom\"><input class=\"fit textfield-border text-center\" ng-model=\"settings[SETTINGS.COMMAND_INTERVALT]\"><tr><td><span class=\"ff-cell-fix\">{{ 'own_limit' | i18n:loc.ale:'fake_sender' }}</span><td><div range-slider=\"\" min=\"settingsMap[SETTINGS.LIMIT_OWNT].min\" max=\"settingsMap[SETTINGS.LIMIT_OWNT].max\" value=\"settings[SETTINGS.LIMIT_OWNT]\" enabled=\"true\"></div><td class=\"cell-bottom\"><input class=\"fit textfield-border text-center\" ng-model=\"settings[SETTINGS.LIMIT_OWNT]\"><tr><td><span class=\"ff-cell-fix\">{{ 'target_limit' | i18n:loc.ale:'fake_sender' }}</span><td><div range-slider=\"\" min=\"settingsMap[SETTINGS.LIMIT_TARGETT].min\" max=\"settingsMap[SETTINGS.LIMIT_TARGETT].max\" value=\"settings[SETTINGS.LIMIT_TARGETT]\" enabled=\"true\"></div><td class=\"cell-bottom\"><input class=\"fit textfield-border text-center\" ng-model=\"settings[SETTINGS.LIMIT_TARGETT]\"><tr><td colspan=\"3\" class=\"item-send\"><span class=\"btn-green btn-border sendTribe\" tooltip=\"\" tooltip-content=\"{{ 'sending_tribe' | i18n:loc.ale:'fake_sender' }}\">{{ 'send' | i18n:loc.ale:'fake_sender' }}</span></table></form><h5 class=\"twx-section\">{{ 'send_groups' | i18n:loc.ale:'fake_sender' }}</h5><form class=\"addForm\"><table class=\"tbl-border-light tbl-striped\"><col width=\"30%\"><col width=\"5%\"><col><col width=\"18%\"><tr><td colspan=\"2\"><span class=\"ff-cell-fix\">{{ 'target_group' | i18n:loc.ale:'fake_sender' }}</span><td colspan=\"2\"><div select=\"\" list=\"groups\" selected=\"settings[SETTINGS.GROUP_TARGET]\" drop-down=\"true\"></div><tr><td><input ng-model=\"commandData.date\" class=\"textfield-border date\" pattern=\"\\s*\\d{1,2}:\\d{1,2}:\\d{1,2}(:\\d{1,3})? \\d{1,2}\\/\\d{1,2}\\/\\d{4}\\s*\" placeholder=\"{{ 'add_date' | i18n:loc.ale:'fake_sender' }}\" tooltip=\"\" tooltip-content=\"hh:mm:ss:SSS dd/MM/yyyy\"><td class=\"text-center\"><span class=\"icon-26x26-time\"></span><td><div select=\"\" list=\"datetype\" selected=\"selectedDateType\" drop-down=\"true\"></div><td class=\"actions\"><a class=\"btn btn-orange\" ng-click=\"reduceDate()\" tooltip=\"\" tooltip-content=\"{{ 'add_current_date_minus' | i18n:loc.ale:'fake_sender' }}\">-</a><a class=\"btn btn-orange\" ng-click=\"addCurrentDate()\" tooltip=\"\" tooltip-content=\"{{ 'add_current_date' | i18n:loc.ale:'fake_sender' }}\">{{ 'now' | i18n:loc.ale:'common' }}</a><a class=\"btn btn-orange\" ng-click=\"incrementDate()\" tooltip=\"\" tooltip-content=\"{{ 'add_current_date_plus' | i18n:loc.ale:'fake_sender' }}\">+</a><tr><td colspan=\"2\"><span class=\"ff-cell-fix\">{{ 'group' | i18n:loc.ale:'fake_sender' }}</span><td colspan=\"2\"><div select=\"\" list=\"groups\" selected=\"settings[SETTINGS.GROUPG]\" drop-down=\"true\"></div><tr><td colspan=\"2\"><span class=\"ff-cell-fix\">{{ 'unit' | i18n:loc.ale:'fake_sender' }}</span><td colspan=\"2\"><div select=\"\" list=\"units\" selected=\"settings[SETTINGS.UNITG]\" drop-down=\"true\"></div><tr><td colspan=\"2\"><span class=\"ff-cell-fix\">{{ 'type' | i18n:loc.ale:'fake_sender' }}</span><td colspan=\"2\"><div select=\"\" list=\"type\" selected=\"settings[SETTINGS.TYPEG]\" drop-down=\"true\"></div></table><table class=\"tbl-border-light tbl-striped\"><col><col width=\"200px\"><col width=\"60px\"><tr><td><span class=\"ff-cell-fix\">{{ 'attack_interval' | i18n:loc.ale:'fake_sender' }}</span><td><div range-slider=\"\" min=\"settingsMap[SETTINGS.COMMAND_INTERVALG].min\" max=\"settingsMap[SETTINGS.COMMAND_INTERVALG].max\" value=\"settings[SETTINGS.COMMAND_INTERVALG]\" enabled=\"true\"></div><td class=\"cell-bottom\"><input class=\"fit textfield-border text-center\" ng-model=\"settings[SETTINGS.COMMAND_INTERVALG]\"><tr><td><span class=\"ff-cell-fix\">{{ 'own_limit' | i18n:loc.ale:'fake_sender' }}</span><td><div range-slider=\"\" min=\"settingsMap[SETTINGS.LIMIT_OWNG].min\" max=\"settingsMap[SETTINGS.LIMIT_OWNG].max\" value=\"settings[SETTINGS.LIMIT_OWNG]\" enabled=\"true\"></div><td class=\"cell-bottom\"><input class=\"fit textfield-border text-center\" ng-model=\"settings[SETTINGS.LIMIT_OWNG]\"><tr><td><span class=\"ff-cell-fix\">{{ 'target_limit' | i18n:loc.ale:'fake_sender' }}</span><td><div range-slider=\"\" min=\"settingsMap[SETTINGS.LIMIT_TARGETG].min\" max=\"settingsMap[SETTINGS.LIMIT_TARGETG].max\" value=\"settings[SETTINGS.LIMIT_TARGETG]\" enabled=\"true\"></div><td class=\"cell-bottom\"><input class=\"fit textfield-border text-center\" ng-model=\"settings[SETTINGS.LIMIT_TARGETG]\"><tr><td colspan=\"3\" class=\"item-send\"><span class=\"btn-green btn-border sendGroups\">{{ 'send' | i18n:loc.ale:'fake_sender' }}</span></table></form></div><div class=\"rich-text\" ng-show=\"selectedTab === TAB_TYPES.LOGS\"><table class=\"tbl-border-light tbl-striped header-center\"><col width=\"25%\"><col width=\"25%\"><col><col><col width=\"20%\"><thead><tr><th>{{ 'logs.origin' | i18n:loc.ale:'fake_sender' }}<th>{{ 'logs.target' | i18n:loc.ale:'fake_sender' }}<th>{{ 'logs.unit' | i18n:loc.ale:'fake_sender' }}<th>{{ 'logs.type' | i18n:loc.ale:'fake_sender' }}<th>{{ 'logs.date' | i18n:loc.ale:'fake_sender' }}<tbody class=\"fakerLog\"><tr class=\"noFakes\"><td colspan=\"5\">{{ 'logs.noFakes' | i18n:loc.ale:'fake_sender' }}</table></div></div></div></div><footer class=\"win-foot\"><ul class=\"list-btn list-center\"><li ng-show=\"selectedTab === TAB_TYPES.FAKE\"><a href=\"#\" class=\"btn-border btn-red\" ng-click=\"clear()\">{{ 'clear' | i18n:loc.ale:'fake_sender' }}</a><li ng-show=\"selectedTab === TAB_TYPES.LOGS\"><a href=\"#\" class=\"btn-border btn-orange\" ng-click=\"clearLogs()\">{{ 'logs.clear' | i18n:loc.ale:'fake_sender' }}</a></ul></footer></div>`)
        interfaceOverflow.addStyle('#two-fake-sender div[select]{float:right}#two-fake-sender div[select] .select-handler{line-height:28px}#two-fake-sender .range-container{width:250px}#two-fake-sender span.select-wrapper{height:34px}#two-fake-sender span.select-wrapper a.select-button{height:23px}#two-fake-sender span.select-wrapper a.select-handler{-webkit-box-shadow:none;box-shadow:none;height:23px;line-height:23px;margin-bottom:-1px}#two-fake-sender .custom-select{width:240px}#two-fake-sender .textfield-border{width:219px;height:34px;margin-bottom:2px;padding-top:2px}#two-fake-sender .textfield-border.fit{width:100%}#two-fake-sender .addForm input{width:100%}#two-fake-sender .addForm td{text-align:left}#two-fake-sender .addForm span{height:26px;line-height:26px;padding:0 10px}#two-fake-sender .actions{text-align:center}#two-fake-sender .actions a{height:26px;line-height:26px;padding:0 10px}#two-fake-sender .fakerLog td{text-align:center}#two-fake-sender .fakerLog .origin:hover{color:#fff;text-shadow:0 1px 0 #000}#two-fake-sender .fakerLog .target:hover{color:#fff;text-shadow:0 1px 0 #000}#two-fake-sender .item-send{text-align:center;width:260px}#two-fake-sender .noFakes td{height:26px;text-align:center}#two-fake-sender .force-26to20{transform:scale(.8);width:20px;height:20px}#two-fake-sender .btn-green{text-align:center}')
    }

    const buildWindow = function () {
        $scope = $rootScope.$new()
        $scope.SETTINGS = SETTINGS
        $scope.TAB_TYPES = TAB_TYPES
        $scope.running = fakeSender.isRunning()
        $scope.selectedTab = TAB_TYPES.FAKE
        $scope.settingsMap = SETTINGS_MAP
        $scope.type = Settings.encodeList(FS_TYPE, {
            textObject: 'fake_sender',
            disabled: true
        })
        $scope.datetype = Settings.encodeList(FS_DATE, {
            textObject: 'fake_sender',
            disabled: true
        })
        $scope.units = Settings.encodeList(FS_UNIT, {
            textObject: 'fake_sender',
            disabled: true
        })

        settings.injectScope($scope)
        eventHandlers.updateGroups()

        $scope.selectTab = selectTab
        $scope.saveSettings = saveSettings
        $scope.switchState = switchState

        let eventScope = new EventScope('twoverflow_fake_sender_window', function onDestroy () {
            console.log('fakeSender closed')
        })

        eventScope.register(eventTypeProvider.GROUPS_CREATED, eventHandlers.updateGroups, true)
        eventScope.register(eventTypeProvider.GROUPS_DESTROYED, eventHandlers.updateGroups, true)
        eventScope.register(eventTypeProvider.GROUPS_UPDATED, eventHandlers.updateGroups, true)
        eventScope.register(eventTypeProvider.FAKE_SENDER_START, eventHandlers.start)
        eventScope.register(eventTypeProvider.FAKE_SENDER_STOP, eventHandlers.stop)
        
        windowManagerService.getScreenWithInjectedScope('!twoverflow_fake_sender_window', $scope)
    }

    return init
})

define('two/fakeSender/settings', [], function () {
    return {
        COMMAND_INTERVAL: 'interval_villages',
        COMMAND_INTERVALP: 'interval_player',
        COMMAND_INTERVALT: 'interval_tribe',
        COMMAND_INTERVALG: 'interval_groups',
        GROUP: 'groups_villages',
        GROUPP: 'groups_player',
        GROUPT: 'groups_tribe',
        GROUPG: 'groups_groups',
        UNIT: 'units_villages',
        UNITP: 'units_player',
        UNITT: 'units_tribe',
        UNITG: 'units_groups',
        TYPE: 'type_villages',
        TYPEP: 'type_player',
        TYPET: 'type_tribe',
        TYPEG: 'type_groups',
        LIMIT_OWN: 'limit_own_villages',
        LIMIT_OWNP: 'limit_own_player',
        LIMIT_OWNT: 'limit_own_tribe',
        LIMIT_OWNG: 'limit_own_groups',
        LIMIT_TARGET: 'limit_target_villages',
        LIMIT_TARGETP: 'limit_target_player',
        LIMIT_TARGETT: 'limit_target_tribe',
        LIMIT_TARGETG: 'limit_target_groups',
        GROUP_TARGET: 'groups_target'
    }
})

define('two/fakeSender/settings/updates', function () {
    return {
        GROUPS: 'groups'
    }
})

define('two/fakeSender/settings/map', [
    'two/fakeSender/settings',
    'two/fakeSender/settings/updates'
], function (
    SETTINGS,
    UPDATES
) {
    return {
        [SETTINGS.GROUP]: {
            default: [],
            updates: [
                UPDATES.GROUPS,
            ],
            disabledOption: true,
            inputType: 'select',
            multiSelect: true,
            type: 'groups'
        },
        [SETTINGS.GROUPP]: {
            default: [],
            updates: [
                UPDATES.GROUPS,
            ],
            disabledOption: true,
            inputType: 'select',
            multiSelect: true,
            type: 'groups'
        },
        [SETTINGS.GROUPT]: {
            default: [],
            updates: [
                UPDATES.GROUPS,
            ],
            disabledOption: true,
            inputType: 'select',
            multiSelect: true,
            type: 'groups'
        },
        [SETTINGS.GROUPG]: {
            default: [],
            updates: [
                UPDATES.GROUPS,
            ],
            disabledOption: true,
            inputType: 'select',
            multiSelect: true,
            type: 'groups'
        },
        [SETTINGS.GROUP_TARGET]: {
            default: [],
            updates: [
                UPDATES.GROUPS,
            ],
            disabledOption: true,
            inputType: 'select',
            multiSelect: true,
            type: 'groups'
        },
        [SETTINGS.TYPE]: {
            default: false,
            disabledOption: true,
            inputType: 'select'
        },
        [SETTINGS.TYPEP]: {
            default: false,
            disabledOption: true,
            inputType: 'select'
        },
        [SETTINGS.TYPET]: {
            default: false,
            disabledOption: true,
            inputType: 'select'
        },
        [SETTINGS.TYPEG]: {
            default: false,
            disabledOption: true,
            inputType: 'select'
        },
        [SETTINGS.UNIT]: {
            default: false,
            multiSelect: true,
            inputType: 'select'
        },
        [SETTINGS.UNITT]: {
            default: false,
            multiSelect: true,
            inputType: 'select'
        },
        [SETTINGS.UNITP]: {
            default: false,
            multiSelect: true,
            inputType: 'select'
        },
        [SETTINGS.UNITG]: {
            default: false,
            multiSelect: true,
            inputType: 'select'
        },
        [SETTINGS.COMMAND_INTERVAL]: {
            default: 2,
            inputType: 'number',
            min: 1,
            max: 3600
        },
        [SETTINGS.COMMAND_INTERVALP]: {
            default: 2,
            inputType: 'number',
            min: 1,
            max: 3600
        },
        [SETTINGS.COMMAND_INTERVALT]: {
            default: 2,
            inputType: 'number',
            min: 1,
            max: 3600
        },
        [SETTINGS.COMMAND_INTERVALG]: {
            default: 2,
            inputType: 'number',
            min: 1,
            max: 3600
        },
        [SETTINGS.LIMIT_OWN]: {
            default: 12,
            inputType: 'number',
            min: 1,
            max: 50
        },
        [SETTINGS.LIMIT_OWNP]: {
            default: 12,
            inputType: 'number',
            min: 1,
            max: 50
        },
        [SETTINGS.LIMIT_OWNT]: {
            default: 12,
            inputType: 'number',
            min: 1,
            max: 50
        },
        [SETTINGS.LIMIT_OWNG]: {
            default: 12,
            inputType: 'number',
            min: 1,
            max: 50
        },
        [SETTINGS.LIMIT_TARGET]: {
            default: 25,
            inputType: 'number',
            min: 1,
            max: 500
        },
        [SETTINGS.LIMIT_TARGETP]: {
            default: 25,
            inputType: 'number',
            min: 1,
            max: 500
        },
        [SETTINGS.LIMIT_TARGETT]: {
            default: 25,
            inputType: 'number',
            min: 1,
            max: 500
        },
        [SETTINGS.LIMIT_TARGETG]: {
            default: 25,
            inputType: 'number',
            min: 1,
            max: 500
        }
    }
})

define('two/fakeSender/types/datetype', [], function () {
    return {
        ARRIVE: 'arrive',
        OUT: 'out'
    }
})

define('two/fakeSender/types/type', [], function () {
    return {
        ATTACK: 'attack',
        SUPPORT: 'support',
        QUATTRO: 'four',
        FULL: 'full'
    }
})

define('two/fakeSender/types/units', [], function () {
    return {
        SPEAR: 'spear',
        SWORD: 'sword',
        AXE: 'axe',
        ARCHER: 'archer',
        LIGHT_CAVALRY: 'light_cavalry',
        MOUNTED_ARCHER: 'mounted_archer',
        HEAVY_CAVALRY: 'heavy_cavalry',
        RAM: 'ram',
        CATAPULT: 'catapult',
        TREBUCHET: 'trebuchet',
        DOPPELSOLDNER: 'doppelsoldner',
        SNOB: 'snob',
        KNIGHT: 'knight'
    }
})
require([
    'two/ready',
    'two/fakeSender',
    'two/fakeSender/ui',
    'two/fakeSender/events'
], function (
    ready,
    fakeSender,
    fakeSenderInterface
) {
    if (fakeSender.isInitialized()) {
        return false
    }

    ready(function () {
        fakeSender.init()
        fakeSenderInterface()
    })
})

define('two/farmOverflow', [
    'two/Settings',
    'two/farmOverflow/types/errors',
    'two/farmOverflow/types/status',
    'two/farmOverflow/settings',
    'two/farmOverflow/settings/map',
    'two/farmOverflow/settings/updates',
    'two/farmOverflow/types/logs',
    'two/mapData',
    'two/utils',
    'two/ready',
    'helper/math',
    'helper/time',
    'queues/EventQueue',
    'conf/commandTypes',
    'conf/village',
    'conf/resourceTypes',
    'struct/MapData',
    'Lockr'
], function (
    Settings,
    ERROR_TYPES,
    STATUS,
    SETTINGS,
    SETTINGS_MAP,
    UPDATES,
    LOG_TYPES,
    twoMapData,
    utils,
    ready,
    math,
    timeHelper,
    eventQueue,
    COMMAND_TYPES,
    VILLAGE_CONFIG,
    RESOURCE_TYPES,
    $mapData,
    Lockr
) {
    let initialized = false
    let running = false
    let settings
    let farmSettings
    let farmers = []
    let logs = []
    let includedVillages = []
    let ignoredVillages = []
    let onlyVillages = []
    let selectedPresets = []
    let activeFarmer = false
    let sendingCommand = false
    let currentTarget = false
    let farmerIndex = 0
    let cycleTimer = null
    let stepDelayTimer = null
    let commandExpireTimer = null
    let exceptionLogs
    let tempVillageReports = {}
    let $player
    let unitsData
    let persistentRunningLastCheck = timeHelper.gameTime()
    let persistentRunningTimer = null
    let nextCycleDate = null
    const PERSISTENT_RUNNING_CHECK_INTERVAL = 30 * 1000
    const VILLAGE_COMMAND_LIMIT = 50
    const MINIMUM_FARMER_CYCLE_INTERVAL = 1 // minutes
    const MINIMUM_ATTACK_INTERVAL = 0 // seconds
    const STEP_EXPIRE_TIME = 30 * 1000
    const CYCLE_BEGIN = 'cycle_begin'
    const IGNORE_UPDATES = 'ignore_update'
    const STORAGE_KEYS = {
        LOGS: 'farm_overflow_logs',
        SETTINGS: 'farm_overflow_settings',
        EXCEPTION_LOGS: 'farm_overflow_exception_logs'
    }
    const RESOURCES = [
        RESOURCE_TYPES.WOOD,
        RESOURCE_TYPES.CLAY,
        RESOURCE_TYPES.IRON,
    ]

    const villageFilters = {
        distance: function (target) {
            return !target.distance.between(
                farmSettings[SETTINGS.MIN_DISTANCE],
                farmSettings[SETTINGS.MAX_DISTANCE]
            )
        },
        ownPlayer: function (target) {
            return target.character_id === $player.getId()
        },
        included: function (target) {
            return target.character_id && !includedVillages.includes(target.id)
        },
        ignored: function (target) {
            return ignoredVillages.includes(target.id)
        },
        points: function (points) {
            return !points.between(
                farmSettings[SETTINGS.MIN_POINTS],
                farmSettings[SETTINGS.MAX_POINTS]
            )
        }
    }

    const targetFilters = [
        villageFilters.distance,
        villageFilters.ownPlayer,
        villageFilters.included,
        villageFilters.ignored
    ]

    const calcDistances = function (targets, origin) {
        return targets.map(function (target) {
            target.distance = math.actualDistance(origin, target)
            return target
        })
    }

    const filterTargets = function (targets) {
        return targets.filter(function (target) {
            return targetFilters.every(function (fn) {
                return !fn(target)
            })
        })
    }

    const sortTargets = function (targets) {
        return targets.sort(function (a, b) {
            return a.distance - b.distance
        })
    }

    const arrayUnique = function (array) {
        return array.sort().filter(function (item, pos, ary) {
            return !pos || item != ary[pos - 1]
        })
    }

    const reloadTimers = function () {
        if (!running) {
            return
        }

        if (stepDelayTimer) {
            stopTimers()
            activeFarmer.targetStep({
                delay: true
            })
        } else if (cycleTimer) {
            stopTimers()

            eventQueue.trigger(eventTypeProvider.FARM_OVERFLOW_CYCLE_BEGIN)

            farmerIndex = 0
            farmerStep()
        }
    }

    const updateIncludedVillage = function () {
        const groupsInclude = farmSettings[SETTINGS.GROUP_INCLUDE]

        includedVillages = []

        groupsInclude.forEach(function (groupId) {
            let groupVillages = modelDataService.getGroupList().getGroupVillageIds(groupId)
            includedVillages = includedVillages.concat(groupVillages)
        })

        includedVillages = arrayUnique(includedVillages)
    }

    const updateIgnoredVillage = function () {
        const groupIgnored = farmSettings[SETTINGS.GROUP_IGNORE]
        ignoredVillages = modelDataService.getGroupList().getGroupVillageIds(groupIgnored)
    }

    const updateOnlyVillage = function () {
        const groupsOnly = farmSettings[SETTINGS.GROUP_ONLY]

        onlyVillages = []

        groupsOnly.forEach(function (groupId) {
            let groupVillages = modelDataService.getGroupList().getGroupVillageIds(groupId)
            groupVillages = groupVillages.filter(function (villageId) {
                return !!$player.getVillage(villageId)
            })

            onlyVillages = onlyVillages.concat(groupVillages)
        })

        onlyVillages = arrayUnique(onlyVillages)
    }

    const updateExceptionLogs = function () {
        const exceptionVillages = ignoredVillages.concat(includedVillages)
        let modified = false

        exceptionVillages.forEach(function (villageId) {
            if (!hasOwn.call(exceptionLogs, villageId)) { 
                exceptionLogs[villageId] = {
                    time: timeHelper.gameTime(),
                    report: false
                }
                modified = true
            }
        })

        utils.each(exceptionLogs, function (time, villageId) {
            villageId = parseInt(villageId, 10)
            
            if (!exceptionVillages.includes(villageId)) {
                delete exceptionLogs[villageId]
                modified = true
            }
        })

        if (modified) {
            Lockr.set(STORAGE_KEYS.EXCEPTION_LOGS, exceptionLogs)
            eventQueue.trigger(eventTypeProvider.FARM_OVERFLOW_EXCEPTION_LOGS_UPDATED)
        }
    }

    const updateGroupVillages = function () {
        updateIncludedVillage()
        updateIgnoredVillage()
        updateOnlyVillage()
        updateExceptionLogs()

        eventQueue.trigger(eventTypeProvider.FARM_OVERFLOW_EXCEPTION_VILLAGES_UPDATED)
    }

    const villageGroupLink = function (event, data) {
        const groupsInclude = farmSettings[SETTINGS.GROUP_INCLUDE]
        const groupIgnore = farmSettings[SETTINGS.GROUP_IGNORE]
        const groupsOnly = farmSettings[SETTINGS.GROUP_ONLY]
        const isOwnVillage = $player.getVillage(data.village_id)
        let farmerListUpdated = false

        updateGroupVillages()

        if (groupIgnore === data.group_id) {
            if (isOwnVillage) {
                removeFarmer(data.village_id)
                farmerListUpdated = true
            } else {
                removeTarget(data.village_id)

                addLog(LOG_TYPES.IGNORED_VILLAGE, {
                    villageId: data.village_id
                })
                addExceptionLog(data.village_id)
            }
        }

        if (groupsInclude.includes(data.group_id) && !isOwnVillage) {
            reloadTargets()

            addLog(LOG_TYPES.INCLUDED_VILLAGE, {
                villageId: data.village_id
            })
            addExceptionLog(data.village_id)
        }

        if (groupsOnly.includes(data.group_id) && isOwnVillage) {
            let farmer = createFarmer(data.village_id)
            farmer.init().then(function () {
                if (running) {
                    farmer.start()
                }
            })

            farmerListUpdated = true
        }

        if (farmerListUpdated) {
            eventQueue.trigger(eventTypeProvider.FARM_OVERFLOW_FARMER_VILLAGES_UPDATED)
        }
    }

    const villageGroupUnlink = function (event, data) {
        const groupsInclude = farmSettings[SETTINGS.GROUP_INCLUDE]
        const groupIgnore = farmSettings[SETTINGS.GROUP_IGNORE]
        const groupsOnly = farmSettings[SETTINGS.GROUP_ONLY]
        const isOwnVillage = $player.getVillage(data.village_id)
        let farmerListUpdated = false

        updateGroupVillages()

        if (groupIgnore === data.group_id) {
            if (isOwnVillage) {
                let farmer = createFarmer(data.village_id)
                farmer.init().then(function () {
                    if (running) {
                        farmer.start()
                    }
                })

                farmerListUpdated = true
            } else {
                reloadTargets()

                addLog(LOG_TYPES.IGNORED_VILLAGE_REMOVED, {
                    villageId: data.village_id
                })
            }
        }

        if (groupsInclude.includes(data.group_id) && !isOwnVillage) {
            reloadTargets()

            addLog(LOG_TYPES.INCLUDED_VILLAGE_REMOVED, {
                villageId: data.village_id
            })
        }

        if (groupsOnly.includes(data.group_id) && isOwnVillage) {
            removeFarmer(data.village_id)
            farmerListUpdated = true
        }

        if (farmerListUpdated) {
            eventQueue.trigger(eventTypeProvider.FARM_OVERFLOW_FARMER_VILLAGES_UPDATED)
        }
    }

    const validGroups = function (_flag) {
        const gameGroups = modelDataService.getGroupList().getGroups()
        const groupIgnore = farmSettings[SETTINGS.GROUP_IGNORE]

        const groupsOnly = farmSettings[SETTINGS.GROUP_ONLY]
        const groupsInclude = farmSettings[SETTINGS.GROUP_INCLUDE]
        const validedGroupIgnore = hasOwn.call(gameGroups, groupIgnore) ? groupIgnore : settings.getDefault(SETTINGS.GROUP_IGNORE)
        const validedGroupsOnly = groupsOnly.filter(groupId => hasOwn.call(gameGroups, groupId))
        const validedGroupsInclude = groupsInclude.filter(groupId => hasOwn.call(gameGroups, groupId))

        settings.setAll({
            [SETTINGS.GROUP_IGNORE]: validedGroupIgnore,
            [SETTINGS.GROUP_ONLY]: validedGroupsOnly,
            [SETTINGS.GROUP_INCLUDE]: validedGroupsInclude
        }, _flag)
    }

    const removedGroupListener = function () {
        validGroups()
        updateGroupVillages()

        flushFarmers()
        reloadTargets()
        createFarmers()
    }

    const processPresets = function () {
        selectedPresets = []
        const playerPresets = modelDataService.getPresetList().getPresets()
        const activePresets = farmSettings[SETTINGS.PRESETS]

        activePresets.forEach(function (presetId) {
            if (!hasOwn.call(playerPresets, presetId)) {
                return
            }

            let preset = playerPresets[presetId]
            preset.load = getPresetHaul(preset)
            preset.travelTime = armyService.calculateTravelTime(preset, {
                barbarian: false,
                officers: false
            })

            selectedPresets.push(preset)
        })

        selectedPresets = selectedPresets.sort(function (a, b) {
            return a.travelTime - b.travelTime || b.load - a.load
        })
    }

    const ignoreVillage = function (villageId) {
        const groupIgnore = farmSettings[SETTINGS.GROUP_IGNORE]

        if (!groupIgnore) {
            return false
        }

        socketService.emit(routeProvider.GROUPS_LINK_VILLAGE, {
            group_id: groupIgnore,
            village_id: villageId
        })

        return true
    }

    const presetListener = function () {
        processPresets()

        if (!selectedPresets.length) {
            eventQueue.trigger(eventTypeProvider.FARM_OVERFLOW_STOP, {
                reason: ERROR_TYPES.NO_PRESETS
            })

            if (running) {
                farmOverflow.stop()
            }
        }
    }

    const reportListener = function (event, data) {
        if (!farmSettings[SETTINGS.IGNORE_ON_LOSS] || !farmSettings[SETTINGS.GROUP_IGNORE]) {
            return
        }

        if (!running || data.type !== COMMAND_TYPES.TYPES.ATTACK) {
            return
        }

        // 1 = nocasualties
        // 2 = casualties
        // 3 = defeat
        if (data.result !== 1 && isTarget(data.target_village_id)) {
            tempVillageReports[data.target_village_id] = {
                haul: data.haul,
                id: data.id,
                result: data.result,
                title: data.title
            }

            ignoreVillage(data.target_village_id)
        }
    }

    const commandSentListener = function (event, data) {
        if (!activeFarmer || !currentTarget) {
            return
        }

        if (data.origin.id !== activeFarmer.getId()) {
            return
        }

        if (data.target.id !== currentTarget.id) {
            return
        }

        if (data.direction === 'forward' && data.type === COMMAND_TYPES.TYPES.ATTACK) {
            activeFarmer.commandSent(data)
        }
    }

    const commandErrorListener = function (event, data) {
        if (!activeFarmer || !sendingCommand || !currentTarget) {
            return
        }

        if (data.cause === routeProvider.SEND_PRESET.type) {
            activeFarmer.commandError(data)
        }
    }

    const getPresetHaul = function (preset) {
        let haul = 0

        utils.each(preset.units, function (unitAmount, unitName) {
            if (unitAmount) {
                haul += unitsData[unitName].load * unitAmount
            }
        })

        return haul
    }

    const addExceptionLog = function (villageId) {
        exceptionLogs[villageId] = {
            time: timeHelper.gameTime(),
            report: tempVillageReports[villageId] || false
        }

        delete tempVillageReports[villageId]

        Lockr.set(STORAGE_KEYS.EXCEPTION_LOGS, exceptionLogs)
        eventQueue.trigger(eventTypeProvider.FARM_OVERFLOW_EXCEPTION_LOGS_UPDATED)
    }

    const addLog = function (type, data = {}) {
        if (typeof type !== 'string') {
            return false
        }

        if (!angular.isObject(data)) {
            data = {}
        }

        data.time = timeHelper.gameTime()
        data.type = type

        logs.unshift(data)
        trimAndSaveLogs()

        return true
    }

    const trimAndSaveLogs = function () {
        const limit = farmSettings[SETTINGS.LOGS_LIMIT]

        if (logs.length > limit) {
            logs.splice(logs.length - limit, logs.length)
        }

        Lockr.set(STORAGE_KEYS.LOGS, logs)
        eventQueue.trigger(eventTypeProvider.FARM_OVERFLOW_LOGS_UPDATED)
    }

    const isTargetBusy = function (attacking, otherAttacking, allVillagesLoaded) {
        const multipleFarmers = farmSettings[SETTINGS.TARGET_MULTIPLE_FARMERS]
        const singleAttack = farmSettings[SETTINGS.TARGET_SINGLE_ATTACK]

        if (multipleFarmers && allVillagesLoaded) {
            if (singleAttack && attacking) {
                return true
            }
        } else if (singleAttack) {
            if (attacking || otherAttacking) {
                return true
            }
        } else if (otherAttacking) {
            return true
        }

        return false
    }

    const enableRequiredPresets = function (villageId, callback) {
        const villagePresets = modelDataService.getPresetList().getPresetsByVillageId(villageId)
        let missingPresets = []

        selectedPresets.forEach(function (preset) {
            if (!hasOwn.call(villagePresets, preset.id)) {
                missingPresets.push(preset.id)
            }
        })

        if (missingPresets.length) {
            // include already enabled presets because you can't only enable
            // missing ones, you need to emit all you want enabled.
            for (let id in villagePresets) {
                if (hasOwn.call(villagePresets, id)) {
                    missingPresets.push(id)
                }
            }

            socketService.emit(routeProvider.ASSIGN_PRESETS, {
                village_id: villageId,
                preset_ids: missingPresets
            }, callback)

            return
        }

        callback()
    }

    const persistentRunningStart = function () {
        let cycleInterval = getCycleInterval()
        let attackInterval = getAttackInterval()
        let timeLimit = cycleInterval + (cycleInterval / 2) + attackInterval

        persistentRunningTimer = setInterval(function () {
            let now = timeHelper.gameTime()

            if (now - persistentRunningLastCheck > timeLimit) {
                farmOverflow.stop()
                setTimeout(farmOverflow.start, 5000)
            }
        }, PERSISTENT_RUNNING_CHECK_INTERVAL)
    }

    const persistentRunningStop = function () {
        clearInterval(persistentRunningTimer)
    }

    const persistentRunningUpdate = function () {
        persistentRunningLastCheck = timeHelper.gameTime()
    }

    const stopTimers = function () {
        clearTimeout(cycleTimer)
        clearTimeout(stepDelayTimer)
        clearTimeout(commandExpireTimer)

        cycleTimer = null
        stepDelayTimer = null
        commandExpireTimer = null
    }

    const getCycleInterval = function () {
        return Math.max(MINIMUM_FARMER_CYCLE_INTERVAL, farmSettings[SETTINGS.FARMER_CYCLE_INTERVAL] * 60 * 1000)
    }

    const getAttackInterval = function () {
        return Math.max(MINIMUM_ATTACK_INTERVAL, farmSettings[SETTINGS.ATTACK_INTERVAL] * 1000)
    }

    const Farmer = function (villageId) {
        this.villageId = villageId
        this.village = $player.getVillage(villageId)

        if (!this.village) {
            throw new Error(`new Farmer -> Village ${villageId} doesn't exist.`)
        }

        this.index = 0
        this.running = false
        this.initialized = false
        this.targets = false
        this.onCycleEndFn = noop
        this.status = STATUS.WAITING_CYCLE
    }

    Farmer.prototype.init = function () {
        let loadPromises = []

        if (!this.isInitialized()) {
            loadPromises.push(new Promise((resolve) => {
                if (this.isInitialized()) {
                    return resolve()
                }

                villageService.ensureVillageDataLoaded(this.villageId, resolve)
            }))

            loadPromises.push(new Promise((resolve) => {
                if (this.isInitialized()) {
                    return resolve()
                }

                this.loadTargets(() => {
                    eventQueue.trigger(eventTypeProvider.FARM_OVERFLOW_INSTANCE_READY, {
                        villageId: this.villageId
                    })
                    resolve()
                })
            }))
        }

        return Promise.all(loadPromises).then(() => {
            this.initialized = true
        })
    }

    Farmer.prototype.start = function () {
        persistentRunningUpdate()

        if (this.running) {
            return false
        }

        if (!this.initialized) {
            eventQueue.trigger(eventTypeProvider.FARM_OVERFLOW_INSTANCE_ERROR_NOT_READY, {
                villageId: this.villageId
            })
            return false
        }

        if (!this.targets.length) {
            eventQueue.trigger(eventTypeProvider.FARM_OVERFLOW_INSTANCE_ERROR_NO_TARGETS, {
                villageId: this.villageId
            })
            return false
        }

        activeFarmer = this
        this.running = true
        eventQueue.trigger(eventTypeProvider.FARM_OVERFLOW_INSTANCE_START, {
            villageId: this.villageId
        })

        this.targetStep({
            delay: false
        })

        return true
    }

    Farmer.prototype.stop = function (reason) {
        this.running = false

        eventQueue.trigger(eventTypeProvider.FARM_OVERFLOW_INSTANCE_STOP, {
            villageId: this.villageId,
            reason: reason
        })

        if (reason === ERROR_TYPES.USER_STOP) {
            this.setStatus(STATUS.USER_STOP)
        }

        stopTimers()

        this.onCycleEndFn(reason)
        this.onCycleEndFn = noop
    }

    Farmer.prototype.targetStep = async function (options = {}) {
        if (!this.running) {
            return false
        }

        persistentRunningUpdate()

        const commandList = this.village.getCommandListModel()
        const villageCommands = commandList.getOutgoingCommands(true, true)
        let selectedPreset = false
        let target
        let checkedLocalCommands = false
        let otherVillageAttacking
        let thisVillageAttacking
        let playerVillages

        const delayStep = () => {
            return new Promise((resolve, reject) => {
                if (options.delay) {
                    stepDelayTimer = setTimeout(() => {
                        stepDelayTimer = null

                        if (!this.running) {
                            return reject(STATUS.USER_STOP)
                        }

                        resolve()
                    }, utils.randomSeconds(getAttackInterval()))
                } else {
                    resolve()
                }
            })
        }

        const checkCommandLimit = () => {
            return new Promise((resolve, reject) => {
                const limit = VILLAGE_COMMAND_LIMIT - farmSettings[SETTINGS.PRESERVE_COMMAND_SLOTS]

                if (villageCommands.length >= limit) {
                    reject(STATUS.COMMAND_LIMIT)
                } else {
                    resolve()
                }
            })
        }

        const checkStorage = () => {
            return new Promise((resolve, reject) => {
                if (farmSettings[SETTINGS.IGNORE_FULL_STORAGE]) {
                    const resources = this.village.getResources()
                    const computed = resources.getComputed()
                    const maxStorage = resources.getMaxStorage()
                    const isFull = RESOURCES.every((type) => computed[type].currentStock === maxStorage)

                    if (isFull) {
                        return reject(STATUS.FULL_STORAGE)
                    }
                }

                resolve()
            })
        }

        const selectTarget = () => {
            return new Promise((resolve, reject) => {
                if (!this.targets.length) {
                    return reject(STATUS.NO_TARGETS)
                }

                if (this.index > this.targets.length || !this.targets[this.index]) {
                    return reject(STATUS.TARGET_CYCLE_END)
                }

                target = this.targets[this.index]

                resolve()
            })
        }

        const checkTarget = () => {
            return new Promise((resolve, reject) => {
                $mapData.getTownAtAsync(target.x, target.y, (data) => {
                    if (villageFilters.points(data.points)) {
                        return reject(STATUS.NOT_ALLOWED_POINTS)
                    }

                    socketService.emit(routeProvider.GET_ATTACKING_FACTOR, {
                        target_id: target.id
                    }, (data) => {
                        if (!this.running) {
                            reject(STATUS.USER_STOP)
                        // abandoned village conquered by some noob.
                        } else if (target.character_id === null && data.owner_id !== null && !includedVillages.includes(target.id)) {
                            reject(STATUS.ABANDONED_CONQUERED)
                        } else if (target.attack_protection) {
                            reject(STATUS.PROTECTED_VILLAGE)
                        } else {
                            resolve()
                        }
                    })
                })
            })
        }

        const checkPresets = () => {
            return new Promise((resolve, reject) => {
                enableRequiredPresets(this.villageId, () => {
                    if (this.running) {
                        resolve()
                    } else {
                        reject(STATUS.USER_STOP)
                    }
                })
            })
        }

        const selectPreset = () => {
            return new Promise((resolve, reject) => {
                const villageUnits = this.village.getUnitInfo().getUnits()
                const maxTravelTime = farmSettings[SETTINGS.MAX_TRAVEL_TIME] * 60
                const villagePosition = this.village.getPosition()
                const targetDistance = math.actualDistance(villagePosition, target)

                utils.each(selectedPresets, (preset) => {
                    let enoughUnits = !Object.entries(preset.units).some((unit) => {
                        const name = unit[0]
                        const amount = unit[1]
                        
                        return villageUnits[name].in_town < amount
                    })

                    if (!enoughUnits) {
                        return
                    }

                    const travelTime = armyService.calculateTravelTime(preset, {
                        barbarian: !target.character_id,
                        officers: false
                    })

                    if (maxTravelTime > travelTime * targetDistance) {
                        selectedPreset = preset
                        resolve()
                    } else {
                        // why reject with TIME_LIMIT if there are more presets to check?
                        // because the preset list is sorted by travel time.
                        reject(STATUS.TIME_LIMIT)
                    }

                    return false
                })

                if (!selectedPreset) {
                    reject(STATUS.NO_UNITS)
                }
            })
        }

        const checkLocalCommands = () => {
            return new Promise((resolve, reject) => {
                otherVillageAttacking = false
                playerVillages = $player.getVillageList()
                
                const allVillagesLoaded = playerVillages.every((anotherVillage) => anotherVillage.isInitialized(VILLAGE_CONFIG.READY_STATES.OWN_COMMANDS))

                if (allVillagesLoaded) {
                    otherVillageAttacking = playerVillages.some((anotherVillage) => {
                        if (anotherVillage.getId() === this.villageId) {
                            return false
                        }

                        const otherVillageCommands = anotherVillage.getCommandListModel().getOutgoingCommands(true, true)

                        return otherVillageCommands.some((command) => {
                            return command.targetVillageId === target.id && command.data.direction === 'forward'
                        })
                    })
                }

                thisVillageAttacking = villageCommands.some((command) => {
                    return command.data.target.id === target.id && command.data.direction === 'forward'
                })

                if (isTargetBusy(thisVillageAttacking, otherVillageAttacking, allVillagesLoaded)) {
                    return reject(STATUS.BUSY_TARGET)
                }

                if (allVillagesLoaded) {
                    checkedLocalCommands = true
                }

                resolve()
            })
        }

        const minimumInterval = () => {
            return new Promise((resolve, reject) => {
                if (!thisVillageAttacking && !otherVillageAttacking) {
                    return resolve()
                }

                const multipleAttacksInterval = farmSettings[SETTINGS.MULTIPLE_ATTACKS_INTERVAL] * 60

                if (!multipleAttacksInterval) {
                    return resolve()
                }

                // if TARGET_SINGLE_ATTACK is enabled, and TARGET_MULTIPLE_FARMERS is disabled
                // there's no reason the check, since the target is allowed to receive multiple
                // attacks simultaneously.
                if (farmSettings[SETTINGS.TARGET_SINGLE_ATTACK] && !farmSettings[SETTINGS.TARGET_MULTIPLE_FARMERS]) {
                    return resolve()
                }

                const now = Math.round(timeHelper.gameTime() / 1000)
                const villages = farmSettings[SETTINGS.TARGET_MULTIPLE_FARMERS] ? playerVillages : [this.village]
                const position = this.village.getPosition()
                const distance = math.actualDistance(position, target)
                const singleFieldtravelTime = armyService.calculateTravelTime(selectedPreset, {
                    barbarian: !target.character_id,
                    officers: true,
                    effects: true
                })
                const commandTravelTime = armyService.getTravelTimeForDistance(selectedPreset, singleFieldtravelTime, distance, COMMAND_TYPES.TYPES.ATTACK)

                const busyTarget = villages.some((village) => {
                    const commands = village.getCommandListModel().getOutgoingCommands(true, true)
                    const targetCommands = commands.filter((command) => command.targetVillageId === target.id && command.data.direction === 'forward')

                    if (targetCommands.length) {
                        return targetCommands.some((command) => {
                            return Math.abs((now + commandTravelTime) - command.time_completed) < multipleAttacksInterval
                        })
                    }
                })

                if (busyTarget) {
                    return reject(STATUS.BUSY_TARGET)
                }

                resolve()
            })
        }

        const checkLoadedCommands = () => {
            return new Promise((resolve, reject) => {
                if (checkedLocalCommands) {
                    return resolve()
                }

                socketService.emit(routeProvider.MAP_GET_VILLAGE_DETAILS, {
                    my_village_id: this.villageId,
                    village_id: target.id,
                    num_reports: 0
                }, (data) => {
                    if (!this.running) {
                        return reject(STATUS.USER_STOP)
                    }

                    const targetCommands = data.commands.own.filter((command) => command.type === COMMAND_TYPES.TYPES.ATTACK && command.direction === 'forward')
                    const otherAttacking = targetCommands.some((command) => command.start_village_id !== this.villageId)
                    const attacking = targetCommands.some((command) => command.start_village_id === this.villageId)

                    if (isTargetBusy(attacking, otherAttacking, true)) {
                        return reject(STATUS.BUSY_TARGET)
                    }

                    resolve()
                })
            })
        }

        const prepareAttack = () => {
            if (!this.running) {
                return false
            }

            this.setStatus(STATUS.ATTACKING)

            sendingCommand = true
            currentTarget = target
            this.index++

            socketService.emit(routeProvider.SEND_PRESET, {
                start_village: this.villageId,
                target_village: target.id,
                army_preset_id: selectedPreset.id,
                type: COMMAND_TYPES.TYPES.ATTACK
            })
        }

        const stepStatus = (status) => {
            stopTimers()

            eventQueue.trigger(eventTypeProvider.FARM_OVERFLOW_INSTANCE_STEP_STATUS, {
                villageId: this.villageId,
                error: status
            })

            switch (status) {
                case STATUS.TIME_LIMIT:
                case STATUS.BUSY_TARGET:
                case STATUS.ABANDONED_CONQUERED:
                case STATUS.PROTECTED_VILLAGE: {
                    this.index++
                    this.setStatus(status)
                    this.targetStep(options)
                    break
                }
                case STATUS.USER_STOP: {
                    this.setStatus(status)
                    break
                }
                case STATUS.NOT_ALLOWED_POINTS: {
                    this.index++
                    this.setStatus(status)
                    removeTarget(target.id)
                    this.targetStep(options)
                    break
                }
                case STATUS.NO_UNITS:
                case STATUS.NO_TARGETS:
                case STATUS.FULL_STORAGE:
                case STATUS.COMMAND_LIMIT: {
                    this.index++
                    this.setStatus(status)
                    this.stop(status)
                    break
                }
                case STATUS.TARGET_CYCLE_END: {
                    this.index = 0
                    this.setStatus(status)
                    this.stop(status)
                    break
                }
                case STATUS.EXPIRED_STEP: {
                    this.setStatus(status)
                    this.targetStep()
                    break
                }
                default: {
                    // eslint-disable-next-line no-console
                    console.error('Unknown status:', status)
                    this.index++
                    this.setStatus(STATUS.UNKNOWN)
                    this.stop(STATUS.UNKNOWN)
                    break
                }
            }
        }

        let attackPromise = new Promise((resolve, reject) => {
            delayStep()
                .then(checkCommandLimit)
                .then(checkStorage)
                .then(selectTarget)
                .then(checkTarget)
                .then(checkPresets)
                .then(selectPreset)
                .then(checkLocalCommands)
                .then(minimumInterval)
                .then(checkLoadedCommands)
                .then(resolve)
                .catch(reject)
        })

        let expirePromise = new Promise((resolve, reject) => {
            commandExpireTimer = setTimeout(() => {
                if (this.running) {
                    reject(STATUS.EXPIRED_STEP)
                }
            }, STEP_EXPIRE_TIME)
        })

        Promise.race([attackPromise, expirePromise])
            .then(prepareAttack)
            .catch(stepStatus)
    }

    Farmer.prototype.setStatus = function (newStatus) {
        this.status = newStatus
    }

    Farmer.prototype.getStatus = function () {
        return this.status || STATUS.UNKNOWN
    }

    Farmer.prototype.commandSent = function (data) {
        sendingCommand = false
        currentTarget = false

        stopTimers()

        addLog(LOG_TYPES.ATTACKED_VILLAGE, {
            targetId: data.target.id
        })

        this.targetStep({
            delay: true
        })
    }

    Farmer.prototype.commandError = function () {
        sendingCommand = false
        currentTarget = false

        this.stop(STATUS.COMMAND_ERROR)
    }

    Farmer.prototype.onCycleEnd = function (handler) {
        this.onCycleEndFn = handler
    }

    Farmer.prototype.loadTargets = function (callback) {
        const pos = this.village.getPosition()

        twoMapData.load((loadedTargets) => {
            this.targets = calcDistances(loadedTargets, pos)
            this.targets = filterTargets(this.targets, pos)
            this.targets = sortTargets(this.targets)
            this.targets = this.targets.slice(0, farmSettings[SETTINGS.TARGET_LIMIT_PER_VILLAGE])

            if (typeof callback === 'function') {
                callback(this.targets)
            }
        })
    }

    Farmer.prototype.getTargets = function () {
        return this.targets
    }

    Farmer.prototype.getIndex = function () {
        return this.index
    }

    Farmer.prototype.getVillage = function () {
        return this.village
    }

    Farmer.prototype.isRunning = function () {
        return this.running
    }

    Farmer.prototype.isInitialized = function () {
        return this.initialized
    }

    Farmer.prototype.removeTarget = function (targetId) {
        if (typeof targetId !== 'number' || !this.targets) {
            return false
        }

        this.targets = this.targets.filter(function (target) {
            return target.id !== targetId
        })

        return true
    }

    Farmer.prototype.getId = function () {
        return this.villageId
    }

    const createFarmer = function (villageId) {
        const groupsOnly = farmSettings[SETTINGS.GROUP_ONLY]

        villageId = parseInt(villageId, 10)

        if (groupsOnly.length && !onlyVillages.includes(villageId)) {
            return false
        }

        if (ignoredVillages.includes(villageId)) {
            return false
        }

        let farmer = farmOverflow.getFarmer(villageId)

        if (!farmer) {
            farmer = new Farmer(villageId)
            farmers.push(farmer)
        }

        return farmer
    }

    const createFarmers = function () {
        utils.each($player.getVillages(), function (village, villageId) {
            createFarmer(villageId)
        })

        eventQueue.trigger(eventTypeProvider.FARM_OVERFLOW_FARMER_VILLAGES_UPDATED)
    }

    /**
     * Clean farmer instances by removing villages based on
     * groups-only, only-villages and ignore-villages group filters.
     */
    const flushFarmers = function () {
        const groupsOnly = farmSettings[SETTINGS.GROUP_ONLY]
        let removeIds = []

        farmers.forEach(function (farmer) {
            let villageId = farmer.getId()

            if (groupsOnly.length && !onlyVillages.includes(villageId)) {
                removeIds.push(villageId)
            } else if (ignoredVillages.includes(villageId)) {
                removeIds.push(villageId)
            }
        })

        if (removeIds.length) {
            removeIds.forEach(function (removeId) {
                removeFarmer(removeId)
            })

            eventQueue.trigger(eventTypeProvider.FARM_OVERFLOW_FARMER_VILLAGES_UPDATED)
        }
    }

    const removeFarmer = function (farmerId) {
        for (let i = 0; i < farmers.length; i++) {
            if (farmers[i].getId() === farmerId) {
                farmers[i].stop(ERROR_TYPES.KILL_FARMER)
                farmers.splice(i, i + 1)

                return true
            }
        }

        return false
    }

    const farmerStep = function (status) {
        persistentRunningUpdate()

        if (!farmers.length) {
            activeFarmer = false
        } else if (farmerIndex >= farmers.length) {
            farmerIndex = 0
            activeFarmer = false
            nextCycleDate = timeHelper.gameTime() + getCycleInterval()
            eventQueue.trigger(eventTypeProvider.FARM_OVERFLOW_CYCLE_END)
        } else {
            activeFarmer = farmers[farmerIndex]
        }

        if (activeFarmer) {
            activeFarmer.onCycleEnd(function (reason) {
                if (reason !== ERROR_TYPES.USER_STOP) {
                    farmerIndex++
                    farmerStep()
                }
            })

            if (status === CYCLE_BEGIN) {
                nextCycleDate = null
                eventQueue.trigger(eventTypeProvider.FARM_OVERFLOW_CYCLE_BEGIN)
            }

            activeFarmer.start()
        } else {
            cycleTimer = setTimeout(function () {
                cycleTimer = null
                farmerIndex = 0
                nextCycleDate = null
                eventQueue.trigger(eventTypeProvider.FARM_OVERFLOW_CYCLE_BEGIN)
                farmerStep()
            }, getCycleInterval())
        }
    }

    const isTarget = function (targetId) {
        for (let i = 0; i < farmers.length; i++) {
            let farmer = farmers[i]
            let targets = farmer.getTargets()

            for (let j = 0; j < targets.length; j++) {
                let target = targets[j]

                if (target.id === targetId) {
                    return true
                }
            }
        }

        return false
    }

    const removeTarget = function (targetId) {
        farmers.forEach(function (farmer) {
            farmer.removeTarget(targetId)
        })
    }

    const reloadTargets = function () {
        twoMapData.load(function () {
            farmers.forEach(function (farmer) {
                farmer.loadTargets()
            })
        }, true)
    }

    let farmOverflow = {}

    farmOverflow.init = function () {
        initialized = true
        logs = Lockr.get(STORAGE_KEYS.LOGS, [])
        exceptionLogs = Lockr.get(STORAGE_KEYS.EXCEPTION_LOGS, {})
        $player = modelDataService.getSelectedCharacter()
        unitsData = modelDataService.getGameData().getUnitsObject()

        settings = new Settings({
            settingsMap: SETTINGS_MAP,
            storageKey: STORAGE_KEYS.SETTINGS
        })

        settings.onChange(function (changes, updates, _flag) {
            farmSettings = settings.getAll()

            if (_flag === IGNORE_UPDATES) {
                return
            }

            if (updates[UPDATES.PRESET]) {
                processPresets()
            }

            if (updates[UPDATES.GROUPS]) {
                updateGroupVillages()
            }

            if (updates[UPDATES.TARGETS]) {
                reloadTargets()
            }

            if (updates[UPDATES.VILLAGES]) {
                flushFarmers()
                createFarmers()
            }

            if (updates[UPDATES.LOGS]) {
                trimAndSaveLogs()
            }

            if (updates[UPDATES.INTERVAL_TIMERS]) {
                reloadTimers()
            }
        })

        farmSettings = settings.getAll()

        validGroups(IGNORE_UPDATES)
        updateGroupVillages()
        createFarmers()

        ready(function () {
            processPresets()
        }, 'presets')

        ready(function () {
            farmers.forEach(function (farmer) {
                farmer.loadTargets()
            })
        }, 'minimap_data')

        $rootScope.$on(eventTypeProvider.ARMY_PRESET_UPDATE, presetListener)
        $rootScope.$on(eventTypeProvider.ARMY_PRESET_DELETED, presetListener)
        $rootScope.$on(eventTypeProvider.GROUPS_VILLAGE_LINKED, villageGroupLink)
        $rootScope.$on(eventTypeProvider.GROUPS_VILLAGE_UNLINKED, villageGroupUnlink)
        $rootScope.$on(eventTypeProvider.GROUPS_DESTROYED, removedGroupListener)
        $rootScope.$on(eventTypeProvider.COMMAND_SENT, commandSentListener)
        $rootScope.$on(eventTypeProvider.MESSAGE_ERROR, commandErrorListener)
        $rootScope.$on(eventTypeProvider.REPORT_NEW, reportListener)
    }

    farmOverflow.start = function () {
        let readyFarmers

        if (running) {
            return false
        }

        if (!selectedPresets.length) {
            eventQueue.trigger(eventTypeProvider.FARM_OVERFLOW_STOP, {
                reason: ERROR_TYPES.NO_PRESETS
            })

            return false
        }

        running = true
        readyFarmers = []

        farmers.forEach(function (farmer) {
            readyFarmers.push(new Promise(function (resolve) {
                farmer.init().then(resolve)
            }))
        })

        if (!readyFarmers.length) {
            running = false
            return false
        }

        Promise.all(readyFarmers).then(function () {
            farmerStep(CYCLE_BEGIN)
        })

        persistentRunningUpdate()
        persistentRunningStart()

        eventQueue.trigger(eventTypeProvider.FARM_OVERFLOW_START)

        addLog(LOG_TYPES.FARM_START)
    }

    farmOverflow.stop = function (reason = STATUS.USER_STOP) {
        if (activeFarmer) {
            activeFarmer.stop(reason)
            
            if (reason !== STATUS.USER_STOP) {
                nextCycleDate = timeHelper.gameTime() + getCycleInterval()
            }

            eventQueue.trigger(eventTypeProvider.FARM_OVERFLOW_CYCLE_END, reason)
        } else {
            nextCycleDate = null
        }

        running = false

        stopTimers()

        eventQueue.trigger(eventTypeProvider.FARM_OVERFLOW_STOP, {
            reason: reason
        })

        persistentRunningStop()

        if (reason === STATUS.USER_STOP) {
            addLog(LOG_TYPES.FARM_STOP)
        }
    }

    farmOverflow.getFarmer = function (farmerId) {
        return farmers.find(function (farmer) {
            return farmer.getId() === farmerId
        })
    }

    farmOverflow.getFarmers = function () {
        return farmers
    }

    farmOverflow.getSettings = function () {
        return settings
    }

    farmOverflow.getExceptionVillages = function () {
        return {
            included: includedVillages,
            ignored: ignoredVillages
        }
    }

    farmOverflow.getExceptionLogs = function () {
        return exceptionLogs
    }

    farmOverflow.isInitialized = function () {
        return initialized
    }

    farmOverflow.isRunning = function () {
        return running
    }

    farmOverflow.getLogs = function () {
        return logs
    }

    farmOverflow.clearLogs = function () {
        logs = []
        Lockr.set(STORAGE_KEYS.LOGS, logs)
        eventQueue.trigger(eventTypeProvider.FARM_OVERFLOW_LOGS_UPDATED)

        return logs
    }

    farmOverflow.getNextCycleDate = function () {
        return nextCycleDate
    }

    farmOverflow.getCycleInterval = getCycleInterval

    return farmOverflow
})

define('two/farmOverflow/events', [], function () {
    angular.extend(eventTypeProvider, {
        FARM_OVERFLOW_START: 'farm_overflow_start',
        FARM_OVERFLOW_STOP: 'farm_overflow_stop',
        FARM_OVERFLOW_INSTANCE_READY: 'farm_overflow_instance_ready',
        FARM_OVERFLOW_INSTANCE_START: 'farm_overflow_instance_start',
        FARM_OVERFLOW_INSTANCE_STOP: 'farm_overflow_instance_stop',
        FARM_OVERFLOW_INSTANCE_ERROR_NO_TARGETS: 'farm_overflow_instance_error_no_targets',
        FARM_OVERFLOW_INSTANCE_ERROR_NOT_READY: 'farm_overflow_instance_error_not_ready',
        FARM_OVERFLOW_INSTANCE_STEP_STATUS: 'farm_overflow_instance_command_status',
        FARM_OVERFLOW_PRESETS_LOADED: 'farm_overflow_presets_loaded',
        FARM_OVERFLOW_LOGS_UPDATED: 'farm_overflow_log_updated',
        FARM_OVERFLOW_COMMAND_SENT: 'farm_overflow_command_sent',
        FARM_OVERFLOW_IGNORED_TARGET: 'farm_overflow_ignored_target',
        FARM_OVERFLOW_VILLAGE_IGNORED: 'farm_overflow_village_ignored',
        FARM_OVERFLOW_EXCEPTION_VILLAGES_UPDATED: 'farm_overflow_exception_villages_updated',
        FARM_OVERFLOW_FARMER_VILLAGES_UPDATED: 'farm_overflow_farmer_villages_updated',
        FARM_OVERFLOW_REPORTS_UPDATED: 'farm_overflow_reports_updated',
        FARM_OVERFLOW_EXCEPTION_LOGS_UPDATED: 'farm_overflow_exception_logs_updated',
        FARM_OVERFLOW_CYCLE_BEGIN: 'farm_overflow_cycle_begin',
        FARM_OVERFLOW_CYCLE_END: 'farm_overflow_cycle_end'
    })
})

define('two/farmOverflow/ui', [
    'two/ui',
    'two/farmOverflow',
    'two/farmOverflow/types/status',
    'two/farmOverflow/types/errors',
    'two/farmOverflow/types/logs',
    'two/farmOverflow/settings',
    'two/Settings',
    'two/EventScope',
    'two/utils',
    'queues/EventQueue',
    'helper/time'
], function (
    interfaceOverflow,
    farmOverflow,
    STATUS,
    ERROR_TYPES,
    LOG_TYPES,
    SETTINGS,
    Settings,
    EventScope,
    utils,
    eventQueue,
    timeHelper
) {
    let $scope
    let settings
    let presetList = modelDataService.getPresetList()
    let groupList = modelDataService.getGroupList()
    let $button
    let villagesInfo = {}
    let villagesLabel = {}
    let cycleCountdownTimer = null
    const TAB_TYPES = {
        SETTINGS: 'settings',
        VILLAGES: 'villages',
        LOGS: 'logs'
    }

    const updateVisibleLogs = function () {
        const offset = $scope.pagination.offset
        const limit = $scope.pagination.limit

        $scope.visibleLogs = $scope.logs.slice(offset, offset + limit)
        $scope.pagination.count = $scope.logs.length

        $scope.visibleLogs.forEach(function (log) {
            if (log.villageId) {
                loadVillageInfo(log.villageId)
            }

            if (log.targetId) {
                loadVillageInfo(log.targetId)
            }
        })
    }

    // TODO: make it shared with other modules
    const loadVillageInfo = function (villageId) {
        if (villagesInfo[villageId]) {
            return villagesInfo[villageId]
        }

        villagesInfo[villageId] = true
        villagesLabel[villageId] = 'LOADING...'

        socketService.emit(routeProvider.MAP_GET_VILLAGE_DETAILS, {
            my_village_id: modelDataService.getSelectedVillage().getId(),
            village_id: villageId,
            num_reports: 1
        }, function (data) {
            villagesInfo[villageId] = {
                x: data.village_x,
                y: data.village_y,
                name: data.village_name,
                last_report: data.last_reports[0]
            }

            villagesLabel[villageId] = `${data.village_name} (${data.village_x}|${data.village_y})`
        })
    }

    const loadExceptionsInfo = function () {
        $scope.exceptionVillages.included.forEach(function (villageId) {
            loadVillageInfo(villageId)
        })
        $scope.exceptionVillages.ignored.forEach(function (villageId) {
            loadVillageInfo(villageId)
        })
    }

    const switchFarm = function () {
        if (farmOverflow.isRunning()) {
            farmOverflow.stop()
        } else {
            farmOverflow.start()
        }
    }

    const selectTab = function (tabType) {
        $scope.selectedTab = tabType
    }

    const saveSettings = function () {
        settings.setAll(settings.decode($scope.settings))
        $scope.saveButtonColor = 'orange'

        utils.notif('success', $filter('i18n')('settings_saved', $rootScope.loc.ale, 'farm_overflow'))
    }

    const removeIgnored = function (villageId) {
        const groupIgnore = settings.get(SETTINGS.GROUP_IGNORE)
        const groupVillages = modelDataService.getGroupList().getGroupVillageIds(groupIgnore)

        if (!groupVillages.includes(villageId)) {
            return false
        }

        socketService.emit(routeProvider.GROUPS_UNLINK_VILLAGE, {
            group_id: groupIgnore,
            village_id: villageId
        })
    }

    const removeIncluded = function (villageId) {
        const groupsInclude = settings.get(SETTINGS.GROUP_INCLUDE)

        groupsInclude.forEach(function (groupId) {
            let groupVillages = modelDataService.getGroupList().getGroupVillageIds(groupId)

            if (groupVillages.includes(villageId)) {
                socketService.emit(routeProvider.GROUPS_UNLINK_VILLAGE, {
                    group_id: groupId,
                    village_id: villageId
                })
            }
        })
    }

    const checkCycleInterval = function () {
        let nextCycleDate = farmOverflow.getNextCycleDate()

        if (nextCycleDate) {
            $scope.showCycleTimer = true
            $scope.nextCycleCountdown = nextCycleDate - timeHelper.gameTime()

            cycleCountdownTimer = setInterval(function () {
                $scope.nextCycleCountdown -= 1000
            }, 1000)
        }
    }

    const eventHandlers = {
        updatePresets: function () {
            $scope.presets = Settings.encodeList(presetList.getPresets(), {
                disabled: false,
                type: 'presets'
            })
        },
        updateGroups: function () {
            $scope.groups = Settings.encodeList(groupList.getGroups(), {
                disabled: false,
                type: 'groups'
            })

            $scope.groupsWithDisabled = Settings.encodeList(groupList.getGroups(), {
                disabled: true,
                type: 'groups'
            })
        },
        start: function () {
            $scope.running = true

            utils.notif('success', $filter('i18n')('farm_started', $rootScope.loc.ale, 'farm_overflow'))
        },
        stop: function (event, data) {
            $scope.running = false
            $scope.showCycleTimer = false
            clearInterval(cycleCountdownTimer)

            switch (data.reason) {
                case ERROR_TYPES.NO_PRESETS: {
                    utils.notif('success', $filter('i18n')('no_preset', $rootScope.loc.ale, 'farm_overflow'))
                    break
                }
                case ERROR_TYPES.USER_STOP: {
                    utils.notif('success', $filter('i18n')('farm_stopped', $rootScope.loc.ale, 'farm_overflow'))
                    break
                }
            }
        },
        updateLogs: function () {
            $scope.logs = angular.copy(farmOverflow.getLogs())
            updateVisibleLogs()

            if (!$scope.logs.length) {
                utils.notif('success', $filter('i18n')('reseted_logs', $rootScope.loc.ale, 'farm_overflow'))
            }
        },
        updateFarmerVillages: function () {
            $scope.farmers = farmOverflow.getFarmers()
        },
        updateExceptionVillages: function () {
            $scope.exceptionVillages = farmOverflow.getExceptionVillages()
            loadExceptionsInfo()
        },
        updateExceptionLogs: function () {
            $scope.exceptionLogs = farmOverflow.getExceptionLogs()
        },
        onCycleBegin: function () {
            $scope.showCycleTimer = false
            clearInterval(cycleCountdownTimer)
        },
        onCycleEnd: function (event, reason) {
            if (reason === STATUS.USER_STOP) {
                return
            }
            
            $scope.showCycleTimer = true
            $scope.nextCycleCountdown = farmOverflow.getCycleInterval()

            cycleCountdownTimer = setInterval(function () {
                $scope.nextCycleCountdown -= 1000
            }, 1000)
        }
    }

    const init = function () {
        settings = farmOverflow.getSettings()
        $button = interfaceOverflow.addMenuButton2('Farmer', 10)

        $button.addEventListener('click', function () {
            buildWindow()
        })

        eventQueue.register(eventTypeProvider.FARM_OVERFLOW_START, function () {
            $button.classList.remove('btn-orange')
            $button.classList.add('btn-red')
        })

        eventQueue.register(eventTypeProvider.FARM_OVERFLOW_STOP, function () {
            $button.classList.remove('btn-red')
            $button.classList.add('btn-orange')
        })

        interfaceOverflow.addTemplate('twoverflow_farm_overflow_window', `<div id=\"two-farmoverflow\" class=\"win-content two-window\"><header class=\"win-head\"><h2>Farmer</h2><ul class=\"list-btn\"><li><a href=\"#\" class=\"size-34x34 btn-red icon-26x26-close\" ng-click=\"closeWindow()\"></a></ul></header><div class=\"win-main\" scrollbar=\"\"><div class=\"tabs tabs-bg\"><div class=\"tabs-three-col\"><div class=\"tab\" ng-click=\"selectTab(TAB_TYPES.SETTINGS)\" ng-class=\"{'tab-active': selectedTab == TAB_TYPES.SETTINGS}\"><div class=\"tab-inner\"><div ng-class=\"{'box-border-light': selectedTab === TAB_TYPES.SETTINGS}\"><a href=\"#\" ng-class=\"{'btn-icon btn-orange': selectedTab !== TAB_TYPES.SETTINGS}\">{{ TAB_TYPES.SETTINGS | i18n:loc.ale:'common' }}</a></div></div></div><div class=\"tab\" ng-click=\"selectTab(TAB_TYPES.VILLAGES)\" ng-class=\"{'tab-active': selectedTab == TAB_TYPES.VILLAGES}\"><div class=\"tab-inner\"><div ng-class=\"{'box-border-light': selectedTab === TAB_TYPES.VILLAGES}\"><a href=\"#\" ng-class=\"{'btn-icon btn-orange': selectedTab !== TAB_TYPES.VILLAGES}\">{{ TAB_TYPES.VILLAGES | i18n:loc.ale:'common' }}</a></div></div></div><div class=\"tab\" ng-click=\"selectTab(TAB_TYPES.LOGS)\" ng-class=\"{'tab-active': selectedTab == TAB_TYPES.LOGS}\"><div class=\"tab-inner\"><div ng-class=\"{'box-border-light': selectedTab === TAB_TYPES.LOGS}\"><a href=\"#\" ng-class=\"{'btn-icon btn-orange': selectedTab !== TAB_TYPES.LOGS}\">{{ TAB_TYPES.LOGS | i18n:loc.ale:'common' }}</a></div></div></div></div></div><div class=\"box-paper footer\"><div class=\"scroll-wrap\"><div class=\"settings\" ng-show=\"selectedTab === TAB_TYPES.SETTINGS\"><table class=\"tbl-border-light tbl-content tbl-medium-height\"><col><col width=\"200px\"><tr><th colspan=\"2\">{{ 'groups_presets' | i18n:loc.ale:'farm_overflow' }}<tr><td><span class=\"ff-cell-fix\">{{ 'presets' | i18n:loc.ale:'farm_overflow' }}</span><td><div select=\"\" list=\"presets\" selected=\"settings[SETTINGS.PRESETS]\" drop-down=\"true\"></div><tr><td><span class=\"ff-cell-fix\">{{ 'group_ignored' | i18n:loc.ale:'farm_overflow' }}</span><td class=\"snowflake\"><div select=\"\" list=\"groupsWithDisabled\" selected=\"settings[SETTINGS.GROUP_IGNORE]\" drop-down=\"true\"></div><tr><td><span class=\"ff-cell-fix\">{{ 'group_include' | i18n:loc.ale:'farm_overflow' }}</span><td><div select=\"\" list=\"groups\" selected=\"settings[SETTINGS.GROUP_INCLUDE]\" drop-down=\"true\"></div><tr><td><span class=\"ff-cell-fix\">{{ 'group_only' | i18n:loc.ale:'farm_overflow' }}</span><td><div select=\"\" list=\"groups\" selected=\"settings[SETTINGS.GROUP_ONLY]\" drop-down=\"true\"></div></table><table class=\"tbl-border-light tbl-content tbl-medium-height\"><col><col width=\"200px\"><col width=\"60px\"><tr><th colspan=\"3\">{{ 'misc' | i18n:loc.ale:'farm_overflow' }}<tr><td><span class=\"ff-cell-fix\">{{ 'attack_interval' | i18n:loc.ale:'farm_overflow' }}</span><td><div range-slider=\"\" min=\"settingsMap[SETTINGS.ATTACK_INTERVAL].min\" max=\"settingsMap[SETTINGS.ATTACK_INTERVAL].max\" value=\"settings[SETTINGS.ATTACK_INTERVAL]\" enabled=\"true\"></div><td class=\"cell-bottom\"><input class=\"fit textfield-border text-center\" ng-model=\"settings[SETTINGS.ATTACK_INTERVAL]\"><tr><td><span class=\"ff-cell-fix\">{{ 'preserve_command_slots' | i18n:loc.ale:'farm_overflow' }}</span><td><div range-slider=\"\" min=\"settingsMap[SETTINGS.PRESERVE_COMMAND_SLOTS].min\" max=\"settingsMap[SETTINGS.PRESERVE_COMMAND_SLOTS].max\" value=\"settings[SETTINGS.PRESERVE_COMMAND_SLOTS]\" enabled=\"true\"></div><td class=\"cell-bottom\"><input class=\"fit textfield-border text-center\" ng-model=\"settings[SETTINGS.PRESERVE_COMMAND_SLOTS]\"><tr><td colspan=\"2\"><span class=\"ff-cell-fix\">{{ 'ignore_on_loss' | i18n:loc.ale:'farm_overflow' }}</span><td><div switch-slider=\"\" enabled=\"settings[SETTINGS.GROUP_IGNORE].value\" border=\"true\" value=\"settings[SETTINGS.IGNORE_ON_LOSS]\" vertical=\"false\" size=\"'56x28'\"></div><tr><td colspan=\"2\"><span class=\"ff-cell-fix\">{{ 'ignore_full_storage' | i18n:loc.ale:'farm_overflow' }}</span><td><div switch-slider=\"\" enabled=\"true\" border=\"true\" value=\"settings[SETTINGS.IGNORE_FULL_STORAGE]\" vertical=\"false\" size=\"'56x28'\"></div><tr><td><span class=\"ff-cell-fix\">{{ 'target_limit_per_village' | i18n:loc.ale:'farm_overflow' }}</span><td><div range-slider=\"\" min=\"settingsMap[SETTINGS.TARGET_LIMIT_PER_VILLAGE].min\" max=\"settingsMap[SETTINGS.TARGET_LIMIT_PER_VILLAGE].max\" value=\"settings[SETTINGS.TARGET_LIMIT_PER_VILLAGE]\" enabled=\"true\"></div><td class=\"cell-bottom\"><input class=\"fit textfield-border text-center\" ng-model=\"settings[SETTINGS.TARGET_LIMIT_PER_VILLAGE]\"></table><table class=\"tbl-border-light tbl-content tbl-medium-height\"><col><col width=\"200px\"><col width=\"60px\"><tr><th colspan=\"3\">{{ 'step_cycle_header' | i18n:loc.ale:'farm_overflow' }}<tr><td colspan=\"2\"><span class=\"ff-cell-fix\">{{ 'target_single_attack' | i18n:loc.ale:'farm_overflow' }}</span><td><div switch-slider=\"\" enabled=\"true\" border=\"true\" value=\"settings[SETTINGS.TARGET_SINGLE_ATTACK]\" vertical=\"false\" size=\"'56x28'\"></div><tr><td colspan=\"2\"><span class=\"ff-cell-fix\">{{ 'target_multiple_farmers' | i18n:loc.ale:'farm_overflow' }}</span><td><div switch-slider=\"\" enabled=\"true\" border=\"true\" value=\"settings[SETTINGS.TARGET_MULTIPLE_FARMERS]\" vertical=\"false\" size=\"'56x28'\"></div><tr><td><span class=\"ff-cell-fix\">{{ 'farmer_cycle_interval' | i18n:loc.ale:'farm_overflow' }}</span><td><div range-slider=\"\" min=\"settingsMap[SETTINGS.FARMER_CYCLE_INTERVAL].min\" max=\"settingsMap[SETTINGS.FARMER_CYCLE_INTERVAL].max\" value=\"settings[SETTINGS.FARMER_CYCLE_INTERVAL]\" enabled=\"true\"></div><td class=\"cell-bottom\"><input class=\"fit textfield-border text-center\" ng-model=\"settings[SETTINGS.FARMER_CYCLE_INTERVAL]\"><tr><td><span class=\"ff-cell-fix\">{{ 'multiple_attacks_interval' | i18n:loc.ale:'farm_overflow' }}</span><td><div range-slider=\"\" min=\"settingsMap[SETTINGS.MULTIPLE_ATTACKS_INTERVAL].min\" max=\"settingsMap[SETTINGS.MULTIPLE_ATTACKS_INTERVAL].max\" value=\"settings[SETTINGS.MULTIPLE_ATTACKS_INTERVAL]\" enabled=\"!(settings[SETTINGS.TARGET_SINGLE_ATTACK] && !settings[SETTINGS.TARGET_MULTIPLE_FARMERS])\"></div><td class=\"cell-bottom\"><input class=\"fit textfield-border text-center\" ng-model=\"settings[SETTINGS.MULTIPLE_ATTACKS_INTERVAL]\" ng-disabled=\"settings[SETTINGS.TARGET_SINGLE_ATTACK] && !settings[SETTINGS.TARGET_MULTIPLE_FARMERS]\"></table><table class=\"tbl-border-light tbl-content tbl-medium-height\"><col><col width=\"200px\"><col width=\"60px\"><tr><th colspan=\"3\">{{ 'target_filters' | i18n:loc.ale:'farm_overflow' }}<tr><td><span class=\"ff-cell-fix\">{{ 'min_distance' | i18n:loc.ale:'farm_overflow' }}</span><td><div range-slider=\"\" min=\"settingsMap[SETTINGS.MIN_DISTANCE].min\" max=\"settingsMap[SETTINGS.MIN_DISTANCE].max\" value=\"settings[SETTINGS.MIN_DISTANCE]\" enabled=\"true\"></div><td class=\"cell-bottom\"><input class=\"fit textfield-border text-center\" ng-model=\"settings[SETTINGS.MIN_DISTANCE]\"><tr><td><span class=\"ff-cell-fix\">{{ 'max_distance' | i18n:loc.ale:'farm_overflow' }}</span><td><div range-slider=\"\" min=\"settingsMap[SETTINGS.MAX_DISTANCE].min\" max=\"settingsMap[SETTINGS.MAX_DISTANCE].max\" value=\"settings[SETTINGS.MAX_DISTANCE]\" enabled=\"true\"></div><td class=\"cell-bottom\"><input class=\"fit textfield-border text-center\" ng-model=\"settings[SETTINGS.MAX_DISTANCE]\"><tr><td><span class=\"ff-cell-fix\">{{ 'min_points' | i18n:loc.ale:'farm_overflow' }}</span><td><div range-slider=\"\" min=\"settingsMap[SETTINGS.MIN_POINTS].min\" max=\"settingsMap[SETTINGS.MIN_POINTS].max\" value=\"settings[SETTINGS.MIN_POINTS]\" enabled=\"true\"></div><td class=\"cell-bottom\"><input class=\"fit textfield-border text-center\" ng-model=\"settings[SETTINGS.MIN_POINTS]\"><tr><td><span class=\"ff-cell-fix\">{{ 'max_points' | i18n:loc.ale:'farm_overflow' }}</span><td><div range-slider=\"\" min=\"settingsMap[SETTINGS.MAX_POINTS].min\" max=\"settingsMap[SETTINGS.MAX_POINTS].max\" value=\"settings[SETTINGS.MAX_POINTS]\" enabled=\"true\"></div><td class=\"cell-bottom\"><input class=\"fit textfield-border text-center\" ng-model=\"settings[SETTINGS.MAX_POINTS]\"><tr><td><span class=\"ff-cell-fix\">{{ 'max_travel_time' | i18n:loc.ale:'farm_overflow' }}</span><td><div range-slider=\"\" min=\"settingsMap[SETTINGS.MAX_TRAVEL_TIME].min\" max=\"settingsMap[SETTINGS.MAX_TRAVEL_TIME].max\" value=\"settings[SETTINGS.MAX_TRAVEL_TIME]\" enabled=\"true\"></div><td class=\"cell-bottom\"><input class=\"fit textfield-border text-center\" ng-model=\"settings[SETTINGS.MAX_TRAVEL_TIME]\"></table><table class=\"tbl-border-light tbl-content tbl-medium-height\"><col><col width=\"200px\"><col width=\"60px\"><tr><th colspan=\"3\">{{ 'others' | i18n:loc.ale:'common' }}<tr><td><span class=\"ff-cell-fix\">{{ 'logs_limit' | i18n:loc.ale:'farm_overflow' }}</span><td><div range-slider=\"\" min=\"settingsMap[SETTINGS.LOGS_LIMIT].min\" max=\"settingsMap[SETTINGS.LOGS_LIMIT].max\" value=\"settings[SETTINGS.LOGS_LIMIT]\" enabled=\"true\"></div><td class=\"cell-bottom\"><input class=\"fit textfield-border text-center\" ng-model=\"settings[SETTINGS.LOGS_LIMIT]\"></table></div><div class=\"villages rich-text\" ng-show=\"selectedTab === TAB_TYPES.VILLAGES\"><p ng-show=\"showCycleTimer\" class=\"text-center\">{{ 'next_cycle_in' | i18n:loc.ale:'farm_overflow' }}: {{ nextCycleCountdown | readableMillisecondsFilter }}<h5 class=\"twx-section\">{{ 'farmer_villages' | i18n:loc.ale:'farm_overflow' }}</h5><p ng-show=\"!farmers.length\" class=\"text-center\">{{ 'no_farmer_villages' | i18n:loc.ale:'farm_overflow' }}<table class=\"tbl-border-light tbl-striped\" ng-show=\"farmers.length\"><col><col width=\"40%\"><col width=\"20%\"><tr><th>{{ 'villages' | i18n:loc.ale:'common' }}<th>{{ 'last_status' | i18n:loc.ale:'farm_overflow' }}<th>{{ 'target' | i18n:loc.ale:'common':2 }}<tr ng-repeat=\"farmer in farmers\"><td><span ng-class=\"{true:'icon-20x20-queue-indicator-long', false:'icon-20x20-queue-indicator-short'}[farmer.isRunning()]\"></span> <a class=\"link\" ng-click=\"openVillageInfo(farmer.getVillage().getId())\"><span class=\"icon-20x20-village\"></span> {{ farmer.getVillage().getName() }} ({{ farmer.getVillage().getX() }}|{{ farmer.getVillage().getY() }})</a><td>{{ 'status_' + farmer.getStatus() | i18n:loc.ale:'farm_overflow' }}<td ng-if=\"farmer.getTargets()\"><span ng-if=\"farmer.isRunning()\">{{ farmer.getIndex() }} / </span><span>{{ farmer.getTargets().length }}</span><td ng-if=\"!farmer.getTargets()\">{{ 'not_loaded' | i18n:loc.ale:'farm_overflow' }}</table><h5 class=\"twx-section\">{{ 'ignored_targets' | i18n:loc.ale:'farm_overflow' }}</h5><p ng-if=\"!exceptionVillages.ignored.length\" class=\"text-center\">{{ 'no_ignored_targets' | i18n:loc.ale:'farm_overflow' }}<table class=\"ignored-villages tbl-border-light tbl-striped\" ng-show=\"exceptionVillages.ignored.length\"><col><col width=\"15%\"><col width=\"15%\"><col width=\"30px\"><tr><th>{{ 'villages' | i18n:loc.ale:'common' }}<th>{{ 'date' | i18n:loc.ale:'farm_overflow' }}<th>{{ 'reports' | i18n:loc.ale:'farm_overflow' }}<th><tr ng-repeat=\"villageId in exceptionVillages.ignored track by $index\"><td><a class=\"link\" ng-click=\"openVillageInfo(villageId)\"><span class=\"icon-20x20-village\"></span> {{ villagesLabel[villageId] }}</a><td>{{ exceptionLogs[villageId].time | readableDateFilter:loc.ale:GAME_TIMEZONE:GAME_TIME_OFFSET }}<td><span ng-if=\"exceptionLogs[villageId].report\"><a class=\"link\" ng-click=\"showReport(exceptionLogs[villageId].report.id)\" tooltip=\"\" tooltip-content=\"{{ exceptionLogs[villageId].report.title }}\"><span class=\"icon-20x20-report\"></span> {{ 'open_report' | i18n:loc.ale:'farm_overflow' }}</a> <span ng-class=\"{2:'icon-20x20-queue-indicator-medium', 3:'icon-20x20-queue-indicator-short'}[exceptionLogs[villageId].report.result]\"></span> <span ng-class=\"{'full': 'icon-26x26-capacity', 'partial':'icon-26x26-capacity-low', 'none':'hidden'}[exceptionLogs[villageId].report.haul]\"></span> </span><span ng-if=\"!exceptionLogs[villageId].report\">{{ 'no_report' | i18n:loc.ale:'farm_overflow' }}</span><td><a href=\"#\" class=\"size-20x20 btn-red icon-20x20-close\" ng-click=\"removeIgnored(villageId)\" tooltip=\"\" tooltip-content=\"\"></a></table><h5 class=\"twx-section\">{{ 'included_targets' | i18n:loc.ale:'farm_overflow' }}</h5><p ng-if=\"!exceptionVillages.included.length\" class=\"text-center\">{{ 'no_included_targets' | i18n:loc.ale:'farm_overflow' }}<table class=\"tbl-border-light tbl-striped\" ng-show=\"exceptionVillages.included.length\"><col><col width=\"15%\"><col width=\"30px\"><tr><th>{{ 'villages' | i18n:loc.ale:'common' }}<th>{{ 'date' | i18n:loc.ale:'farm_overflow' }}<th><tr ng-repeat=\"villageId in exceptionVillages.included track by $index\"><td><a class=\"link\" ng-click=\"openVillageInfo(villageId)\"><span class=\"icon-20x20-village\"></span> {{ villagesLabel[villageId] }}</a><td>{{ exceptionLogs[villageId].time | readableDateFilter:loc.ale:GAME_TIMEZONE:GAME_TIME_OFFSET }}<td><a href=\"#\" class=\"size-20x20 btn-red icon-20x20-close\" ng-click=\"removeIncluded(villageId)\" tooltip=\"\" tooltip-content=\"\"></a></table></div><div class=\"logs rich-text\" ng-show=\"selectedTab === TAB_TYPES.LOGS\"><div class=\"page-wrap\" pagination=\"pagination\"></div><p class=\"text-center\" ng-show=\"!visibleLogs.length\">{{ 'no_logs' | i18n:loc.ale:'farm_overflow' }}<table class=\"log-list tbl-border-light tbl-striped\" ng-show=\"visibleLogs.length\"><col width=\"100px\"><col width=\"30px\"><col><tr ng-repeat=\"log in visibleLogs track by $index\"><td>{{ log.time | readableDateFilter:loc.ale:GAME_TIMEZONE:GAME_TIME_OFFSET }}<td><span class=\"icon-bg-black\" ng-class=\"{
                                'icon-26x26-dot-green': log.type === LOG_TYPES.FARM_START,
                                'icon-26x26-dot-red': log.type === LOG_TYPES.FARM_STOP,
                                'icon-26x26-check-negative': log.type === LOG_TYPES.IGNORED_VILLAGE || log.type === LOG_TYPES.INCLUDED_VILLAGE_REMOVED,
                                'icon-26x26-check-positive': log.type === LOG_TYPES.INCLUDED_VILLAGE || log.type === LOG_TYPES.IGNORED_VILLAGE_REMOVED,
                                'icon-26x26-attack-small': log.type === LOG_TYPES.ATTACKED_VILLAGE}\"></span><td ng-if=\"log.type === LOG_TYPES.ATTACKED_VILLAGE\"><span class=\"icon-26x26-attack-small\"></span> <a class=\"link\" ng-click=\"openVillageInfo(log.targetId)\"><span class=\"icon-20x20-village\"></span> {{ villagesLabel[log.targetId] }}</a><td ng-if=\"log.type === LOG_TYPES.IGNORED_VILLAGE\"><a class=\"link\" ng-click=\"openVillageInfo(log.villageId)\"><span class=\"icon-20x20-village\"></span> {{ villagesLabel[log.villageId] }}</a> {{ 'ignored_village' | i18n:loc.ale:'farm_overflow' }}<td ng-if=\"log.type === LOG_TYPES.IGNORED_VILLAGE_REMOVED\"><a class=\"link\" ng-click=\"openVillageInfo(log.villageId)\"><span class=\"icon-20x20-village\"></span> {{ villagesLabel[log.villageId] }}</a> {{ 'ignored_village_removed' | i18n:loc.ale:'farm_overflow' }}<td ng-if=\"log.type === LOG_TYPES.INCLUDED_VILLAGE\"><a class=\"link\" ng-click=\"openVillageInfo(log.villageId)\"><span class=\"icon-20x20-village\"></span> {{ villagesLabel[log.villageId] }}</a> {{ 'included_village' | i18n:loc.ale:'farm_overflow' }}<td ng-if=\"log.type === LOG_TYPES.INCLUDED_VILLAGE_REMOVED\"><a class=\"link\" ng-click=\"openVillageInfo(log.villageId)\"><span class=\"icon-20x20-village\"></span> {{ villagesLabel[log.villageId] }}</a> {{ 'included_village_removed' | i18n:loc.ale:'farm_overflow' }}<td ng-if=\"log.type === LOG_TYPES.FARM_START\">{{ 'farm_started' | i18n:loc.ale:'farm_overflow' }}<td ng-if=\"log.type === LOG_TYPES.FARM_STOP\">{{ 'farm_stopped' | i18n:loc.ale:'farm_overflow' }}</table><div class=\"page-wrap\" pagination=\"pagination\"></div></div></div></div></div><footer class=\"win-foot\"><ul class=\"list-btn list-center\"><li ng-show=\"selectedTab === TAB_TYPES.SETTINGS\"><a href=\"#\" class=\"btn-border btn-{{ saveButtonColor }}\" ng-click=\"saveSettings()\">{{ 'save' | i18n:loc.ale:'common' }}</a><li ng-show=\"selectedTab === TAB_TYPES.LOGS\"><a href=\"#\" class=\"btn-border btn-orange\" ng-click=\"clearLogs()\">{{ 'clear_logs' | i18n:loc.ale:'farm_overflow' }}</a><li><a href=\"#\" ng-class=\"{false:'btn-green', true:'btn-red'}[running]\" class=\"btn-border\" ng-click=\"switchFarm()\"><span ng-show=\"running\">{{ 'pause' | i18n:loc.ale:'common' }}</span> <span ng-show=\"!running\">{{ 'start' | i18n:loc.ale:'common' }}</span></a></ul></footer></div>`)
        interfaceOverflow.addStyle('#two-farmoverflow .settings table{margin-bottom:15px}#two-farmoverflow .settings input.textfield-border{width:219px;height:34px;margin-bottom:2px;padding-top:2px}#two-farmoverflow .settings input.textfield-border.fit{width:100%}#two-farmoverflow .settings span.select-wrapper{width:219px}#two-farmoverflow .settings a.select-handler{line-height:28px}#two-farmoverflow .settings td.snowflake a.select-handler{line-height:31px}#two-farmoverflow .settings .range-container{width:250px}#two-farmoverflow .villages td{padding:2px 5px;white-space:nowrap}#two-farmoverflow .villages .hidden{display:none}#two-farmoverflow .logs .status tr{height:25px}#two-farmoverflow .logs .status td{padding:0 6px}#two-farmoverflow .logs .log-list{margin-bottom:10px}#two-farmoverflow .logs .log-list td{white-space:nowrap;text-align:center;padding:0 5px}#two-farmoverflow .logs .log-list td .village-link{max-width:200px;white-space:nowrap;text-overflow:ellipsis}#two-farmoverflow .icon-20x20-village:before{margin-top:-11px}')
    }

    const buildWindow = function () {
        let ignoreWatch = true

        $scope = $rootScope.$new()
        $scope.SETTINGS = SETTINGS
        $scope.TAB_TYPES = TAB_TYPES
        $scope.LOG_TYPES = LOG_TYPES
        $scope.running = farmOverflow.isRunning()
        $scope.selectedTab = TAB_TYPES.SETTINGS
        $scope.farmers = farmOverflow.getFarmers()
        $scope.villagesLabel = villagesLabel
        $scope.villagesInfo = villagesInfo
        $scope.exceptionVillages = farmOverflow.getExceptionVillages()
        $scope.exceptionLogs = farmOverflow.getExceptionLogs()
        $scope.logs = farmOverflow.getLogs()
        $scope.visibleLogs = []
        $scope.showCycleTimer = false
        $scope.nextCycleCountdown = 0
        $scope.saveButtonColor = 'orange'
        $scope.settingsMap = settings.settingsMap

        $scope.pagination = {
            count: $scope.logs.length,
            offset: 0,
            loader: updateVisibleLogs,
            limit: storageService.getPaginationLimit()
        }

        settings.injectScope($scope)
        eventHandlers.updatePresets()
        eventHandlers.updateGroups()
        updateVisibleLogs()
        loadExceptionsInfo()
        checkCycleInterval()

        // scope functions
        $scope.switchFarm = switchFarm
        $scope.selectTab = selectTab
        $scope.saveSettings = saveSettings
        $scope.clearLogs = farmOverflow.clearLogs
        $scope.jumpToVillage = mapService.jumpToVillage
        $scope.openVillageInfo = windowDisplayService.openVillageInfo
        $scope.showReport = reportService.showReport
        $scope.removeIgnored = removeIgnored
        $scope.removeIncluded = removeIncluded

        let eventScope = new EventScope('twoverflow_farm_overflow_window', function onDestroy () {
            clearInterval(cycleCountdownTimer)
        })

        eventScope.register(eventTypeProvider.ARMY_PRESET_UPDATE, eventHandlers.updatePresets, true)
        eventScope.register(eventTypeProvider.ARMY_PRESET_DELETED, eventHandlers.updatePresets, true)
        eventScope.register(eventTypeProvider.GROUPS_UPDATED, eventHandlers.updateGroups, true)
        eventScope.register(eventTypeProvider.GROUPS_CREATED, eventHandlers.updateGroups, true)
        eventScope.register(eventTypeProvider.GROUPS_DESTROYED, eventHandlers.updateGroups, true)
        eventScope.register(eventTypeProvider.FARM_OVERFLOW_START, eventHandlers.start)
        eventScope.register(eventTypeProvider.FARM_OVERFLOW_STOP, eventHandlers.stop)
        eventScope.register(eventTypeProvider.FARM_OVERFLOW_LOGS_UPDATED, eventHandlers.updateLogs)
        eventScope.register(eventTypeProvider.FARM_OVERFLOW_FARMER_VILLAGES_UPDATED, eventHandlers.updateFarmerVillages)
        eventScope.register(eventTypeProvider.FARM_OVERFLOW_EXCEPTION_VILLAGES_UPDATED, eventHandlers.updateExceptionVillages)
        eventScope.register(eventTypeProvider.FARM_OVERFLOW_EXCEPTION_LOGS_UPDATED, eventHandlers.updateExceptionLogs)
        eventScope.register(eventTypeProvider.FARM_OVERFLOW_CYCLE_BEGIN, eventHandlers.onCycleBegin)
        eventScope.register(eventTypeProvider.FARM_OVERFLOW_CYCLE_END, eventHandlers.onCycleEnd)

        windowManagerService.getScreenWithInjectedScope('!twoverflow_farm_overflow_window', $scope)

        $scope.$watch('settings', function () {
            if (!ignoreWatch) {
                $scope.saveButtonColor = 'red'
            }

            ignoreWatch = false
        }, true)
    }

    return init
})

define('two/farmOverflow/settings', [], function () {
    return {
        PRESETS: 'presets',
        GROUP_IGNORE: 'group_ignore',
        GROUP_INCLUDE: 'group_include',
        GROUP_ONLY: 'group_only',
        MAX_DISTANCE: 'max_distance',
        MIN_DISTANCE: 'min_distance',
        IGNORE_FULL_STORAGE: 'ignore_full_storage',        
        ATTACK_INTERVAL: 'attack_interval',
        MAX_TRAVEL_TIME: 'max_travel_time',
        TARGET_SINGLE_ATTACK: 'target_single_attack',
        TARGET_MULTIPLE_FARMERS: 'target_multiple_farmers',
        MULTIPLE_ATTACKS_INTERVAL: 'multiple_attacks_interval',
        PRESERVE_COMMAND_SLOTS: 'preserve_command_slots',
        FARMER_CYCLE_INTERVAL: 'farmer_cycle_interval',
        MIN_POINTS: 'min_points',
        MAX_POINTS: 'max_points',
        LOGS_LIMIT: 'logs_limit',
        IGNORE_ON_LOSS: 'ignore_on_loss',
        TARGET_LIMIT: 'target_limit'
    }
})

define('two/farmOverflow/settings/updates', function () {
    return {
        PRESET: 'preset',
        GROUPS: 'groups',
        TARGETS: 'targets',
        VILLAGES: 'villages',
        WAITING_VILLAGES: 'waiting_villages',
        FULL_STORAGE: 'full_storage',
        LOGS: 'logs',
        INTERVAL_TIMERS: 'interval_timers'
    }
})

define('two/farmOverflow/settings/map', [
    'two/farmOverflow/settings',
    'two/farmOverflow/settings/updates'
], function (
    SETTINGS,
    UPDATES
) {
    return {
        [SETTINGS.PRESETS]: {
            default: [],
            updates: [
                UPDATES.PRESET,
                UPDATES.INTERVAL_TIMERS
            ],
            disabledOption: true,
            inputType: 'select',
            multiSelect: true,
            type: 'presets'
        },
        [SETTINGS.GROUP_IGNORE]: {
            default: false,
            updates: [
                UPDATES.GROUPS,
                UPDATES.INTERVAL_TIMERS
            ],
            disabledOption: true,
            inputType: 'select',
            type: 'groups'
        },
        [SETTINGS.GROUP_INCLUDE]: {
            default: [],
            updates: [
                UPDATES.GROUPS,
                UPDATES.TARGETS,
                UPDATES.INTERVAL_TIMERS
            ],
            disabledOption: true,
            inputType: 'select',
            multiSelect: true,
            type: 'groups'
        },
        [SETTINGS.GROUP_ONLY]: {
            default: [],
            updates: [
                UPDATES.GROUPS,
                UPDATES.VILLAGES,
                UPDATES.TARGETS,
                UPDATES.INTERVAL_TIMERS
            ],
            disabledOption: true,
            inputType: 'select',
            multiSelect: true,
            type: 'groups'
        },
        [SETTINGS.ATTACK_INTERVAL]: {
            default: 2,
            updates: [UPDATES.INTERVAL_TIMERS],
            inputType: 'number',
            min: 0,
            max: 120
        },
        [SETTINGS.FARMER_CYCLE_INTERVAL]: {
            default: 5,
            updates: [UPDATES.INTERVAL_TIMERS],
            inputType: 'number',
            min: 1,
            max: 120
        },
        [SETTINGS.TARGET_SINGLE_ATTACK]: {
            default: false,
            updates: [],
            inputType: 'checkbox'
        },
        [SETTINGS.TARGET_MULTIPLE_FARMERS]: {
            default: true,
            updates: [UPDATES.INTERVAL_TIMERS],
            inputType: 'checkbox'
        },
        [SETTINGS.MULTIPLE_ATTACKS_INTERVAL]: {
            default: 5,
            updates: [UPDATES.INTERVAL_TIMERS],
            inputType: 'number',
            min: 0,
            max: 60
        },
        [SETTINGS.PRESERVE_COMMAND_SLOTS]: {
            default: 5,
            updates: [],
            inputType: 'number',
            min: 0,
            max: 50
        },
        [SETTINGS.IGNORE_ON_LOSS]: {
            default: true,
            updates: [],
            inputType: 'checkbox'
        },
        [SETTINGS.IGNORE_FULL_STORAGE]: {
            default: true,
            updates: [UPDATES.INTERVAL_TIMERS],
            inputType: 'checkbox'
        },
        [SETTINGS.MIN_DISTANCE]: {
            default: 0,
            updates: [
                UPDATES.TARGETS,
                UPDATES.INTERVAL_TIMERS
            ],
            inputType: 'number',
            min: 0,
            max: 50
        },
        [SETTINGS.MAX_DISTANCE]: {
            default: 15,
            updates: [
                UPDATES.TARGETS,
                UPDATES.INTERVAL_TIMERS
            ],
            inputType: 'number',
            min: 0,
            max: 50
        },
        [SETTINGS.MIN_POINTS]: {
            default: 0,
            updates: [
                UPDATES.TARGETS,
                UPDATES.INTERVAL_TIMERS
            ],
            inputType: 'number',
            min: 0,
            max: 11223
        },
        [SETTINGS.MAX_POINTS]: {
            default: 3600,
            updates: [
                UPDATES.TARGETS,
                UPDATES.INTERVAL_TIMERS
            ],
            inputType: 'number',
            min: 0,
            max: 11223
        },
        [SETTINGS.MAX_TRAVEL_TIME]: {
            default: 90,
            updates: [UPDATES.INTERVAL_TIMERS],
            inputType: 'number',
            min: 0,
            max: 300
        },
        [SETTINGS.LOGS_LIMIT]: {
            default: 500,
            updates: [UPDATES.LOGS],
            inputType: 'number',
            min: 0,
            max: 2000
        },
        [SETTINGS.TARGET_LIMIT_PER_VILLAGE]: {
            default: 25,
            updates: [UPDATES.TARGETS],
            min: 0,
            max: 500
        }
    }
})

define('two/farmOverflow/types/errors', [], function () {
    return {
        NO_PRESETS: 'no_presets',
        USER_STOP: 'user_stop',
        KILL_FARMER: 'kill_farmer'
    }
})

define('two/farmOverflow/types/status', [], function () {
    return {
        TIME_LIMIT: 'time_limit',
        COMMAND_LIMIT: 'command_limit',
        FULL_STORAGE: 'full_storage',
        NO_UNITS: 'no_units',
        NO_SELECTED_VILLAGE: 'no_selected_village',
        ABANDONED_CONQUERED: 'abandoned_conquered',
        PROTECTED_VILLAGE: 'protected_village',
        BUSY_TARGET: 'busy_target',
        NO_TARGETS: 'no_targets',
        TARGET_CYCLE_END: 'target_cycle_end',
        FARMER_CYCLE_END: 'farmer_cycle_end',
        COMMAND_ERROR: 'command_error',
        NOT_ALLOWED_POINTS: 'not_allowed_points',
        UNKNOWN: 'unknown',
        ATTACKING: 'attacking',
        WAITING_CYCLE: 'waiting_cycle',
        USER_STOP: 'user_stop',
        EXPIRED_STEP: 'expired_step'
    }
})

define('two/farmOverflow/types/logs', [], function () {
    return {
        FARM_START: 'farm_start',
        FARM_STOP: 'farm_stop',
        IGNORED_VILLAGE: 'ignored_village',
        INCLUDED_VILLAGE: 'included_village',
        IGNORED_VILLAGE_REMOVED: 'ignored_village_removed',
        INCLUDED_VILLAGE_REMOVED: 'included_village_removed',
        ATTACKED_VILLAGE: 'attacked_village'
    }
})

require([
    'two/ready',
    'two/farmOverflow',
    'two/farmOverflow/ui',
    'two/farmOverflow/events'
], function (
    ready,
    farmOverflow,
    farmOverflowInterface
) {
    if (farmOverflow.isInitialized()) {
        return false
    }

    ready(function () {
        farmOverflow.init()
        farmOverflowInterface()
    }, ['map', 'presets'])
})

define('two/minimap', [
    'two/minimap/types/actions',
    'two/minimap/types/mapSizes',
    'two/minimap/settings',
    'two/minimap/settings/map',
    'two/minimap/settings/updates',
    'two/utils',
    'two/ready',
    'two/Settings',
    'two/mapData',
    'queues/EventQueue',
    'Lockr',
    'struct/MapData',
    'helper/mapconvert',
    'cdn',
    'conf/colors',
    'conf/colorGroups',
    'conf/conf',
    'states/MapState'
], function (
    ACTION_TYPES,
    MAP_SIZE_TYPES,
    SETTINGS,
    SETTINGS_MAP,
    UPDATES,
    utils,
    ready,
    Settings,
    twoMapData,
    eventQueue,
    Lockr,
    mapData,
    mapconvert,
    cdn,
    colors,
    colorGroups,
    conf,
    mapState
) {
    let renderingEnabled = false
    let highlights = {}
    let villageSize
    let villageMargin = 1
    let villageBlock
    let lineSize
    let blockOffset
    let allVillages
    let mappedData = {
        village: {},
        character: {},
        tribe: {}
    }
    let boundariesX = { a: 0, b: 0 }
    let boundariesY = { a: 0, b: 0 }
    let viewBoundariesX = { a: 0, b: 0 }
    let viewBoundariesY = { a: 0, b: 0 }
    let selectedVillage
    let currentPosition = {}
    let currentCoords = {}
    let mappedVillages = {}
    let hoveredVillage = false
    let hoveredVillageX
    let hoveredVillageY
    let $viewport
    let viewportContext
    let $viewportCache
    let viewportCacheContext
    let $viewportRef
    let viewportRefContext
    let $map
    let $mapWrapper
    let $player
    let playerId
    let playerTribeId
    let villageColors
    let tribeRelations
    let settings
    let minimapSettings
    const STORAGE_KEYS = {
        CACHE_VILLAGES: 'minimap_cache_villages',
        SETTINGS: 'minimap_settings'
    }
    const MAP_SIZES = {
        [MAP_SIZE_TYPES.VERY_SMALL]: 2,
        [MAP_SIZE_TYPES.SMALL]: 3,
        [MAP_SIZE_TYPES.BIG]: 5,
        [MAP_SIZE_TYPES.VERY_BIG]: 7
    }
    const INTERFACE_HEIGHT = 265
    const BORDER_PADDING = 10
    const BORDER_COLOR = '#2B4700'
    const colorService = injector.get('colorService')
    const spriteFactory = injector.get('spriteFactory')
    
    let allowJump = true
    let allowMove = false
    let dragStart = {}
    let highlightSprite
    let currentMouseCoords = {
        x: 0,
        y: 0
    }
    let firstDraw = true
    const rhexcolor = /^#?([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/

    /**
     * Calcule the coords from clicked position in the canvas.
     *
     * @param {Object} event - Canvas click event.
     * @return {Object} X and Y coordinates.
     */
    const getCoords = function (event) {
        let rawX = Math.ceil(currentPosition.x + event.offsetX) - blockOffset
        let rawY = Math.ceil(currentPosition.y + event.offsetY) + blockOffset

        if (Math.floor((rawY / villageBlock)) % 2) {
            rawX += blockOffset
        }

        rawX -= rawX % villageBlock
        rawY -= rawY % villageBlock

        return {
            x: Math.ceil((rawX - $viewport.width / 2) / villageBlock),
            y: Math.ceil((rawY - $viewport.height / 2) / villageBlock)
        }
    }

    /**
     * Convert pixel wide map position to coords
     *
     * @param {Number} x - X pixel position.
     * @param {Number} y - Y pixel position.
     * @return {Object} Y and Y coordinates.
     */
    const pixel2Tiles = function (x, y) {
        return {
            x: (x / conf.TILESIZE.x),
            y: (y / conf.TILESIZE.y / conf.TILESIZE.off)
        }
    }

    /**
     * Calculate the coords based on zoom.
     *
     * @param {Array[x, y, canvasW, canvasH]} rect - Coords and canvas size.
     * @param {Number} zoom - Current zoom used to display the game original map.
     * @return {Array} Calculated coords.
     */
    const convert = function (rect, zoom) {
        zoom = 1 / (zoom || 1)

        const xy = pixel2Tiles(rect[0] * zoom, rect[1] * zoom)
        const wh = pixel2Tiles(rect[2] * zoom, rect[3] * zoom)
        
        return [
            xy.x - 1,
            xy.y - 1,
            (wh.x + 3) || 1,
            (wh.y + 3) || 1
        ]
    }

    const drawBorders = function () {
        const binUrl = cdn.getPath(conf.getMapPath())
        const continentEnabled = minimapSettings[SETTINGS.SHOW_CONTINENT_DEMARCATIONS]
        const provinceEnabled = minimapSettings[SETTINGS.SHOW_PROVINCE_DEMARCATIONS]

        const drawContinent = function (x, y) {
            viewportCacheContext.fillStyle = minimapSettings[SETTINGS.COLOR_CONTINENT]
            viewportCacheContext.fillRect(x * villageBlock + blockOffset - 1, y * villageBlock + blockOffset - 1, 3, 1)
            viewportCacheContext.fillRect(x * villageBlock + blockOffset, y * villageBlock + blockOffset - 2, 1, 3)
        }

        const drawProvince = function (x, y) {
            viewportCacheContext.fillStyle = minimapSettings[SETTINGS.COLOR_PROVINCE]
            viewportCacheContext.fillRect(x * villageBlock + blockOffset, y * villageBlock + blockOffset - 1, 1, 1)
        }

        utils.xhrGet(binUrl, 'arraybuffer').then(function (xhr) {
            const dataView = new DataView(xhr.response)
            const paddedBoundariesX = {
                a: boundariesX.a - BORDER_PADDING,
                b: boundariesX.b + BORDER_PADDING
            }
            const paddedBoundariesY = {
                a: boundariesY.a - BORDER_PADDING,
                b: boundariesY.b + BORDER_PADDING
            }

            if (continentEnabled || provinceEnabled) {
                for (let x = paddedBoundariesX.a; x < paddedBoundariesX.b; x++) {
                    for (let y = paddedBoundariesY.a; y < paddedBoundariesY.b; y++) {
                        const tile = mapconvert.toTile(dataView, x, y)

                        // is border
                        if (tile.key.b) {
                            // is continental border
                            if (tile.key.c) {
                                if (continentEnabled) {
                                    drawContinent(x, y)
                                } else if (provinceEnabled) {
                                    drawProvince(x, y)
                                }
                            } else if (provinceEnabled) {
                                drawProvince(x, y)
                            }
                        }
                    }
                }
            }

            const borderX = paddedBoundariesX.a * villageBlock
            const borderY = paddedBoundariesY.a * villageBlock
            const borderWidth = (paddedBoundariesX.b - paddedBoundariesX.a) * villageBlock
            const borderHeight = (paddedBoundariesY.b - paddedBoundariesY.a) * villageBlock

            viewportCacheContext.beginPath()
            viewportCacheContext.lineWidth = 2
            viewportCacheContext.strokeStyle = BORDER_COLOR
            viewportCacheContext.rect(borderX, borderY, borderWidth, borderHeight)
            viewportCacheContext.stroke()
        })
    }

    const drawLoadedVillages = function () {
        drawVillages(allVillages)
    }

    /**
     * @param {Object} pos - Minimap current position plus center of canvas.
     */
    const drawViewport = function (pos) {
        viewportContext.drawImage($viewportCache, -pos.x, -pos.y)
    }

    const clearViewport = function () {
        viewportContext.clearRect(0, 0, $viewport.width, $viewport.height)
    }

    /**
     * @param {Object} pos - Minimap current position plus center of canvas.
     */
    const drawViewReference = function (pos) {
        const mapPosition = minimap.getMapPosition()
        const x = ((mapPosition.x - 2) * villageBlock) - pos.x
        const y = ((mapPosition.y - 2) * villageBlock) - pos.y

        // cross
        viewportRefContext.fillStyle = minimapSettings[SETTINGS.COLOR_VIEW_REFERENCE]
        viewportRefContext.fillRect(x, 0, 1, lineSize)
        viewportRefContext.fillRect(0, y, lineSize, 1)

        const mapRect = $mapWrapper.getBoundingClientRect()
        const refRectWidth = (mapRect.width / conf.TILESIZE.x / mapState.view.z) * villageBlock
        const refRectHeight = (mapRect.height / conf.TILESIZE.y / mapState.view.z) * villageBlock
        const refRectX = x - (refRectWidth / 2)
        const refRectY = y - (refRectHeight / 2)

        // view rect
        viewportRefContext.clearRect(refRectX, refRectY, refRectWidth, refRectHeight)
        viewportRefContext.beginPath()
        viewportRefContext.lineWidth = 1
        viewportRefContext.strokeStyle = minimapSettings[SETTINGS.COLOR_VIEW_REFERENCE]
        viewportRefContext.rect(refRectX, refRectY, refRectWidth, refRectHeight)
        viewportRefContext.stroke()
    }

    const clearCross = function () {
        viewportRefContext.clearRect(0, 0, $viewportRef.width, $viewportRef.height)
    }

    const renderStep = function () {
        if (renderingEnabled) {
            const pos = {
                x: currentPosition.x - ($viewport.width / 2),
                y: currentPosition.y - ($viewport.height / 2)
            }

            clearViewport()
            clearCross()
            drawViewport(pos)

            if (minimapSettings[SETTINGS.SHOW_VIEW_REFERENCE]) {
                drawViewReference(pos)
            }
        }

        window.requestAnimationFrame(renderStep)
    }

    const cacheVillages = function (villages) {
        for (let i = 0, l = villages.length; i < l; i++) {
            let v = villages[i]

            // meta village
            if (v.id < 0) {
                continue
            }

            if (!(v.x in mappedData.village)) {
                mappedData.village[v.x] = {}
            }

            if (!(v.x in mappedVillages)) {
                mappedVillages[v.x] = []
            }

            mappedData.village[v.x][v.y] = v.character_id || 0
            mappedVillages[v.x][v.y] = v

            if (v.character_id) {
                if (v.character_id in mappedData.character) {
                    mappedData.character[v.character_id].push([v.x, v.y])
                } else {
                    mappedData.character[v.character_id] = [[v.x, v.y]]
                }

                if (v.tribe_id) {
                    if (v.tribe_id in mappedData.tribe) {
                        mappedData.tribe[v.tribe_id].push(v.character_id)
                    } else {
                        mappedData.tribe[v.tribe_id] = [v.character_id]
                    }
                }
            }
        }
    }

    const setBoundaries = function () {
        let allX = []
        let allY = []

        for (let x in mappedData.village) {
            allX.push(x)

            for (let y in mappedData.village[x]) {
                allY.push(y)
            }
        }

        boundariesX.a = Math.min(...allX)
        boundariesX.b = Math.max(...allX)
        boundariesY.a = Math.min(...allY)
        boundariesY.b = Math.max(...allY)

        viewBoundariesX.a = boundariesX.a * villageBlock
        viewBoundariesX.b = boundariesX.b * villageBlock
        viewBoundariesY.a = boundariesY.a * villageBlock
        viewBoundariesY.b = boundariesY.b * villageBlock
    }

    const onHoverVillage = function (coords, event) {
        if (hoveredVillage) {
            if (hoveredVillageX === coords.x && hoveredVillageY === coords.y) {
                return false
            } else {
                onBlurVillage()
            }
        }

        hoveredVillage = true
        hoveredVillageX = coords.x
        hoveredVillageY = coords.y

        eventQueue.trigger(eventTypeProvider.MINIMAP_VILLAGE_HOVER, {
            x: hoveredVillageX,
            y: hoveredVillageY,
            event: event
        })

        const pid = mappedData.village[hoveredVillageX][hoveredVillageY]

        if (pid) {
            highlightVillages(mappedData.character[pid])
        } else {
            highlightVillages([[hoveredVillageX, hoveredVillageY]])
        }
    }

    const onBlurVillage = function () {
        if (!hoveredVillage) {
            return false
        }

        const pid = mappedData.village[hoveredVillageX][hoveredVillageY]

        if (pid) {
            unhighlightVillages(mappedData.character[pid])
        } else {
            unhighlightVillages([[hoveredVillageX, hoveredVillageY]])
        }

        hoveredVillage = false
        eventQueue.trigger(eventTypeProvider.MINIMAP_VILLAGE_BLUR, {
            x: hoveredVillageX,
            y: hoveredVillageY
        })
    }

    const highlightVillages = function (villages) {
        let villagesData = []

        for (let i = 0; i < villages.length; i++) {
            let x = villages[i][0]
            let y = villages[i][1]

            villagesData.push(mappedVillages[x][y])
        }

        drawVillages(villagesData, minimapSettings[SETTINGS.COLOR_QUICK_HIGHLIGHT])
    }

    const unhighlightVillages = function (villages) {
        let villagesData = []

        for (let i = 0; i < villages.length; i++) {
            let x = villages[i][0]
            let y = villages[i][1]

            villagesData.push(mappedVillages[x][y])
        }

        drawVillages(villagesData)
    }

    const showHighlightSprite = function (x, y) {
        let pos = mapService.tileCoordinate2Pixel(x, y)
        highlightSprite.setTranslation(pos[0] - 25, pos[1] + 2)
        highlightSprite.alpha = 1
    }

    const hideHighlightSprite = function () {
        highlightSprite.alpha = 0
    }

    const quickHighlight = function (x, y) {
        mapData.getTownAtAsync(x, y, function (village) {
            if (!village) {
                return false
            }

            switch (minimapSettings[SETTINGS.RIGHT_CLICK_ACTION]) {
                case ACTION_TYPES.HIGHLIGHT_PLAYER: {
                    if (!village.character_id) {
                        return false
                    }

                    minimap.addHighlight({
                        type: 'character',
                        id: village.character_id
                    }, colors.palette.flat().random())

                    break
                }
                case ACTION_TYPES.HIGHLIGHT_TRIBE: {
                    if (!village.tribe_id) {
                        return false
                    }

                    minimap.addHighlight({
                        type: 'tribe',
                        id: village.tribe_id
                    }, colors.palette.flat().random())

                    break
                }
            }
        })
    }

    const getVillageColor = function (village) {
        if (minimapSettings[SETTINGS.SHOW_ONLY_CUSTOM_HIGHLIGHTS]) {
            if (village.character_id in highlights.character) {
                return highlights.character[village.character_id]
            } else if (village.tribe_id in highlights.tribe) {
                return highlights.tribe[village.tribe_id]
            }

            return false
        }

        if (!village.character_id) {
            if (minimapSettings[SETTINGS.SHOW_BARBARIANS]) {
                return villageColors.barbarian
            }

            return false
        }

        if (village.character_id === playerId) {
            if (village.id === selectedVillage.getId() && minimapSettings[SETTINGS.HIGHLIGHT_SELECTED]) {
                return villageColors.selected
            } else if (village.character_id in highlights.character) {
                return highlights.character[village.character_id]
            } else if (minimapSettings[SETTINGS.HIGHLIGHT_OWN]) {
                return villageColors.player
            }
        } else if (village.character_id in highlights.character) {
            return highlights.character[village.character_id]
        } else if (village.tribe_id in highlights.tribe) {
            return highlights.tribe[village.tribe_id]
        } else if (playerTribeId && playerTribeId === village.tribe_id && minimapSettings[SETTINGS.HIGHLIGHT_DIPLOMACY]) {
            return villageColors.tribe
        } else if (tribeRelations && minimapSettings[SETTINGS.HIGHLIGHT_DIPLOMACY]) {
            if (tribeRelations.isAlly(village.tribe_id)) {
                return villageColors.ally
            } else if (tribeRelations.isEnemy(village.tribe_id)) {
                return villageColors.enemy
            } else if (tribeRelations.isNAP(village.tribe_id)) {
                return villageColors.friendly
            }
        }

        return villageColors.ugly
    }

    const drawVillages = function (villages, predefinedColor) {
        for (let i = 0; i < villages.length; i++) {
            const village = villages[i]

            // meta village
            if (village.id < 0) {
                continue
            }

            const color = predefinedColor || getVillageColor(village)

            if (!color) {
                continue
            }

            const x = village.x * villageBlock + (village.y % 2 ? blockOffset : 0)
            const y = village.y * villageBlock

            viewportCacheContext.fillStyle = color
            viewportCacheContext.fillRect(x, y, villageSize, villageSize)
        }
    }

    const updateMinimapValues = function () {
        villageSize = MAP_SIZES[minimapSettings[SETTINGS.MAP_SIZE]]
        blockOffset = Math.round(villageSize / 2)
        villageBlock = villageSize + villageMargin
        lineSize = villageBlock * 1000
        
        viewBoundariesX.a = boundariesX.a * villageBlock
        viewBoundariesX.b = boundariesX.b * villageBlock
        viewBoundariesY.a = boundariesY.a * villageBlock
        viewBoundariesY.b = boundariesY.b * villageBlock

        $viewportCache.width = 1000 * villageBlock
        $viewportCache.height = 1000 * villageBlock
        viewportCacheContext.imageSmoothingEnabled = false
    }

    const setViewportSize = function () {
        const WIDTH = 686
        const HEIGHT = document.body.clientHeight - INTERFACE_HEIGHT

        $viewport.width = WIDTH
        $viewport.height = HEIGHT
        $viewportRef.width = WIDTH
        $viewportRef.height = HEIGHT

        viewportContext.imageSmoothingEnabled = false
        viewportRefContext.imageSmoothingEnabled = false
    }

    const eventHandlers = {
        onViewportRefMouseDown: function (event) {
            event.preventDefault()

            allowJump = true
            allowMove = true
            dragStart.x = currentPosition.x + event.pageX
            dragStart.y = currentPosition.y + event.pageY

            if (hoveredVillage) {
                eventQueue.trigger(eventTypeProvider.MINIMAP_VILLAGE_CLICK, [
                    hoveredVillageX,
                    hoveredVillageY,
                    event
                ])

                // right click
                if (event.which === 3) {
                    quickHighlight(hoveredVillageX, hoveredVillageY)
                }
            }

            eventQueue.trigger(eventTypeProvider.MINIMAP_START_MOVE)
        },
        onViewportRefMouseUp: function () {
            allowMove = false
            dragStart = {}

            if (!allowJump) {
                eventQueue.trigger(eventTypeProvider.MINIMAP_STOP_MOVE)
            }
        },
        onViewportRefMouseMove: function (event) {
            allowJump = false
            currentMouseCoords = getCoords(event)

            if (allowMove) {
                currentPosition.x = (dragStart.x - event.pageX).bound(viewBoundariesX.a, viewBoundariesX.b)
                currentPosition.y = (dragStart.y - event.pageY).bound(viewBoundariesY.a, viewBoundariesY.b)
                currentCoords.x = currentMouseCoords.x
                currentCoords.y = currentMouseCoords.y
                return false
            }

            if (currentCoords.x !== currentMouseCoords.x || currentCoords.y !== currentMouseCoords.y) {
                hideHighlightSprite()
                showHighlightSprite(currentMouseCoords.x, currentMouseCoords.y)
            }

            if (currentMouseCoords.x in mappedVillages && currentMouseCoords.y in mappedVillages[currentMouseCoords.x]) {
                let village = mappedVillages[currentMouseCoords.x][currentMouseCoords.y]

                // ignore barbarian villages
                if (!minimapSettings[SETTINGS.SHOW_BARBARIANS] && !village.character_id) {
                    return false
                }

                // check if the village is custom highlighted
                if (minimapSettings[SETTINGS.SHOW_ONLY_CUSTOM_HIGHLIGHTS]) {
                    let highlighted = false

                    if (village.character_id in highlights.character) {
                        highlighted = true
                    } else if (village.tribe_id in highlights.tribe) {
                        highlighted = true
                    }

                    if (!highlighted) {
                        return false
                    }
                }

                return onHoverVillage(currentMouseCoords, event)
            }

            onBlurVillage()
        },
        onViewportRefMouseLeave: function () {
            if (hoveredVillage) {
                onBlurVillage()
            }

            eventQueue.trigger(eventTypeProvider.MINIMAP_MOUSE_LEAVE)
        },
        onViewportRefMouseClick: function (event) {
            if (!allowJump) {
                return false
            }

            const coords = getCoords(event)
            mapService.jumpToVillage(coords.x, coords.y)
        },
        onViewportRefMouseContext: function (event) {
            event.preventDefault()
            return false
        },
        onHighlightChange: function () {
            highlights.tribe = colorService.getCustomColorsByGroup(colorGroups.TRIBE_COLORS) || {}
            highlights.character = colorService.getCustomColorsByGroup(colorGroups.PLAYER_COLORS) || {}

            drawLoadedVillages()
        },
        onSelectedVillageChange: function () {
            const old = {
                id: selectedVillage.getId(),
                x: selectedVillage.getX(),
                y: selectedVillage.getY()
            }

            selectedVillage = $player.getSelectedVillage()

            drawVillages([{
                character_id: $player.getId(),
                id: old.id,
                x: old.x,
                y: old.y
            }, {
                character_id: $player.getId(),
                id: selectedVillage.getId(),
                x: selectedVillage.getX(),
                y: selectedVillage.getY()
            }])
        }
    }

    let minimap = {}

    /**
     * @param {Object} item - Highlight item.
     * @param {String} item.type - player or tribe
     * @param {String} item.id - player/tribe id
     * @param {String} color - Hex color
     *
     * @return {Boolean} true if successfully added
     */
    minimap.addHighlight = function (item, color) {
        if (!item || !item.type || !item.id || !hasOwn.call(highlights, item.type)) {
            eventQueue.trigger(eventTypeProvider.MINIMAP_HIGHLIGHT_ADD_ERROR_NO_ENTRY)
            return false
        }

        if (!rhexcolor.test(color)) {
            eventQueue.trigger(eventTypeProvider.MINIMAP_HIGHLIGHT_ADD_ERROR_INVALID_COLOR)
            return false
        }

        highlights[item.type][item.id] = color[0] !== '#' ? '#' + color : color
        const colorGroup = item.type === 'character' ? colorGroups.PLAYER_COLORS : colorGroups.TRIBE_COLORS
        colorService.setCustomColorsByGroup(colorGroup, highlights[item.type])
        $rootScope.$broadcast(eventTypeProvider.GROUPS_VILLAGES_CHANGED)

        drawLoadedVillages()

        return true
    }

    minimap.removeHighlight = function (type, itemId) {
        if (typeof itemId === 'undefined' || !hasOwn.call(highlights, type)) {
            return false
        }

        if (!hasOwn.call(highlights[type], itemId)) {
            return false
        }

        delete highlights[type][itemId]
        const colorGroup = type === 'character' ? colorGroups.PLAYER_COLORS : colorGroups.TRIBE_COLORS
        colorService.setCustomColorsByGroup(colorGroup, highlights[type])
        $rootScope.$broadcast(eventTypeProvider.GROUPS_VILLAGES_CHANGED)
        drawLoadedVillages()

        return true
    }

    minimap.getHighlight = function (type, item) {
        if (hasOwn.call(highlights[type], item)) {
            return highlights[type][item]
        } else {
            return false
        }
    }

    minimap.getHighlights = function () {
        return highlights
    }

    minimap.eachHighlight = function (callback) {
        for (let type in highlights) {
            for (let id in highlights[type]) {
                callback(type, id, highlights[type][id])
            }
        }
    }

    minimap.setViewport = function (element) {
        $viewport = element
        $viewport.style.background = minimapSettings[SETTINGS.COLOR_BACKGROUND]
        viewportContext = $viewport.getContext('2d')
    }

    minimap.setViewportRef = function (element) {
        $viewportRef = element
        viewportRefContext = $viewportRef.getContext('2d')
    }

    minimap.setCurrentPosition = function (x, y) {
        currentPosition.x = (x * villageBlock)
        currentPosition.y = (y * villageBlock)
        currentCoords.x = Math.ceil(x)
        currentCoords.y = Math.ceil(y)
    }

    /**
     * @return {Array}
     */
    minimap.getMapPosition = function () {
        if (!$map.width || !$map.height) {
            return false
        }

        let view = mapData.getMap().engine.getView()
        let converted = convert([
            -view.x,
            -view.y,
            $map.width / 2,
            $map.height / 2
        ], view.z)

        return {
            x: converted[0] + converted[2],
            y: converted[1] + converted[3]
        }
    }

    minimap.getSettings = function () {
        return settings
    }

    minimap.drawMinimap = function () {
        if (firstDraw) {
            firstDraw = false
        }

        $viewport.style.background = minimapSettings[SETTINGS.COLOR_BACKGROUND]
        viewportCacheContext.clearRect(0, 0, $viewportCache.width, $viewportCache.height)

        ready(function () {
            drawBorders()
            drawLoadedVillages()
        }, 'minimap_data')
    }

    minimap.enableRendering = function enableRendering () {
        renderingEnabled = true
    }

    minimap.disableRendering = function disableRendering () {
        renderingEnabled = false
    }

    minimap.isFirstDraw = function () {
        return !!firstDraw
    }

    minimap.init = function () {
        minimap.initialized = true
        $viewportCache = document.createElement('canvas')
        viewportCacheContext = $viewportCache.getContext('2d')
        highlightSprite = spriteFactory.make('hover')
        
        settings = new Settings({
            settingsMap: SETTINGS_MAP,
            storageKey: STORAGE_KEYS.SETTINGS
        })

        settings.onChange(function (changes, updates) {
            minimapSettings = settings.getAll()
            updateMinimapValues()

            if (updates[UPDATES.MAP_POSITION]) {
                minimap.setCurrentPosition(currentCoords.x, currentCoords.y)
            }

            if (updates[UPDATES.MINIMAP]) {
                minimap.drawMinimap()
            }
        })

        minimapSettings = settings.getAll()
        highlights.tribe = colorService.getCustomColorsByGroup(colorGroups.TRIBE_COLORS) || {}
        highlights.character = colorService.getCustomColorsByGroup(colorGroups.PLAYER_COLORS) || {}
        updateMinimapValues()
    }

    minimap.run = function () {
        ready(function () {
            $mapWrapper = document.getElementById('map')
            $map = document.getElementById('main-canvas')
            $player = modelDataService.getSelectedCharacter()
            tribeRelations = $player.getTribeRelations()
            playerId = $player.getId()
            playerTribeId = $player.getTribeId()
            villageColors = $player.getVillagesColors()

            highlightSprite.alpha = 0
            mapState.graph.layers.effects.push(highlightSprite)

            setViewportSize()

            selectedVillage = $player.getSelectedVillage()
            currentCoords.x = selectedVillage.getX()
            currentCoords.y = selectedVillage.getY()
            currentPosition.x = selectedVillage.getX() * villageBlock
            currentPosition.y = selectedVillage.getY() * villageBlock

            window.addEventListener('resize', setViewportSize, false)
            $viewportRef.addEventListener('mousedown', eventHandlers.onViewportRefMouseDown)
            $viewportRef.addEventListener('mouseup', eventHandlers.onViewportRefMouseUp)
            $viewportRef.addEventListener('mousemove', eventHandlers.onViewportRefMouseMove)
            $viewportRef.addEventListener('mouseleave', eventHandlers.onViewportRefMouseLeave)
            $viewportRef.addEventListener('click', eventHandlers.onViewportRefMouseClick)
            $viewportRef.addEventListener('contextmenu', eventHandlers.onViewportRefMouseContext)

            twoMapData.load(function () {
                allVillages = twoMapData.getVillages()
                cacheVillages(allVillages)
                setBoundaries()
                renderStep()

                $rootScope.$on(eventTypeProvider.VILLAGE_SELECTED_CHANGED, eventHandlers.onSelectedVillageChange)
                $rootScope.$on(eventTypeProvider.TRIBE_RELATION_CHANGED, drawLoadedVillages)
                $rootScope.$on(eventTypeProvider.GROUPS_VILLAGES_CHANGED, eventHandlers.onHighlightChange)
            })
        }, ['initial_village', 'tribe_relations'])
    }

    return minimap
})

define('two/minimap/events', [], function () {
    angular.extend(eventTypeProvider, {
        MINIMAP_HIGHLIGHT_ADD_ERROR_EXISTS: 'minimap_highlight_add_error_exists',
        MINIMAP_HIGHLIGHT_ADD_ERROR_NO_ENTRY: 'minimap_highlight_add_error_no_entry',
        MINIMAP_HIGHLIGHT_ADD_ERROR_INVALID_COLOR: 'minimap_highlight_add_error_invalid_color',
        MINIMAP_VILLAGE_CLICK: 'minimap_village_click',
        MINIMAP_VILLAGE_HOVER: 'minimap_village_hover',
        MINIMAP_VILLAGE_BLUR: 'minimap_village_blur',
        MINIMAP_MOUSE_LEAVE: 'minimap_mouse_leave',
        MINIMAP_START_MOVE: 'minimap_start_move',
        MINIMAP_STOP_MOVE: 'minimap_stop_move',
        MINIMAP_AREA_LOADED: 'minimap_area_loaded'
    })
})

define('two/minimap/ui', [
    'two/ui',
    'two/minimap',
    'two/minimap/types/actions',
    'two/minimap/types/mapSizes',
    'two/minimap/settings',
    'two/minimap/settings/map',
    'two/utils',
    'two/EventScope',
    'two/Settings',
    'helper/util',
    'struct/MapData',
    'cdn',
    'conf/colors'
], function (
    interfaceOverflow,
    minimap,
    ACTION_TYPES,
    MAP_SIZE_TYPES,
    SETTINGS,
    SETTINGS_MAP,
    utils,
    EventScope,
    Settings,
    util,
    mapData,
    cdn,
    colors
) {
    let $scope
    let $button
    let $minimapCanvas
    let $viewportRefCanvas
    let $minimapContainer
    let MapController
    let windowWrapper
    let mapWrapper
    let tooltipWrapper
    let tooltipQueue = {}
    let allowTooltip = false
    let currentVillageHash
    let highlightNames = {
        character: {},
        tribe: {}
    }
    let settings
    const TAB_TYPES = {
        MINIMAP: 'minimap',
        HIGHLIGHTS: 'highlights',
        SETTINGS: 'settings'
    }
    const DEFAULT_TAB = TAB_TYPES.MINIMAP

    const selectTab = function (tab) {
        $scope.selectedTab = tab

        if (tab === TAB_TYPES.MINIMAP) {
            minimap.enableRendering()
        } else {
            minimap.disableRendering()
        }
    }

    const appendCanvas = function () {
        $minimapContainer = document.querySelector('#two-minimap .minimap-container')
        $minimapContainer.appendChild($minimapCanvas)
        $minimapContainer.appendChild($viewportRefCanvas)
    }

    const getTribeData = function (data, callback) {
        socketService.emit(routeProvider.TRIBE_GET_PROFILE, {
            tribe_id: data.id
        }, callback)
    }
    
    const getCharacterData = function (data, callback) {
        socketService.emit(routeProvider.CHAR_GET_PROFILE, {
            character_id: data.id
        }, callback)
    }

    const updateHighlightNames = function () {
        Object.keys($scope.highlights.character).forEach(function (id) {
            if (id in highlightNames.character) {
                return
            }

            getCharacterData({
                id: id
            }, function (data) {
                highlightNames.character[id] = data.character_name
            })
        })

        Object.keys($scope.highlights.tribe).forEach(function (id) {
            if (id in highlightNames.tribe) {
                return
            }

            getTribeData({
                id: id
            }, function (data) {
                highlightNames.tribe[id] = data.name
            })
        })
    }

    const loadVillageData = function (x, y) {
        return new Promise(function (resolve) {
            let village = mapData.getTownAt(x, y)

            if (village) {
                return resolve(village)
            }

            mapData.loadTownDataAsync(x, y, 1, 1, function (village) {
                resolve(village)
            })
        })
    }

    const genVillageHash = function (x, y) {
        return String(x) + String(y)
    }

    const showTooltip = function (event, data) {
        if (!tooltipWrapper) {
            return
        }

        let villageHash = genVillageHash(data.x, data.y)
        currentVillageHash = villageHash
        tooltipQueue[villageHash] = true
        allowTooltip = true

        loadVillageData(data.x, data.y).then(function (village) {
            if (!tooltipQueue[genVillageHash(village.x, village.y)]) {
                return
            }

            if (!allowTooltip) {
                return
            }

            windowWrapper.appendChild(tooltipWrapper)
            tooltipWrapper.classList.remove('ng-hide')

            MapController.tt.name = village.name
            MapController.tt.x = village.x
            MapController.tt.y = village.y
            MapController.tt.province_name = village.province_name
            MapController.tt.points = village.points
            MapController.tt.character_name = village.character_name || '-'
            MapController.tt.character_points = village.character_points || 0
            MapController.tt.tribe_name = village.tribe_name || '-'
            MapController.tt.tribe_tag = village.tribe_tag || '-'
            MapController.tt.tribe_points = village.tribe_points || 0
            MapController.tt.morale = village.morale || 0
            MapController.tt.position = {}
            MapController.tt.position.x = data.event.pageX + 50
            MapController.tt.position.y = data.event.pageY + 50
            MapController.tt.visible = true

            const tooltipOffset = tooltipWrapper.getBoundingClientRect()
            const windowOffset = windowWrapper.getBoundingClientRect()
            const tooltipWrapperSpacerX = tooltipOffset.width + 50
            const tooltipWrapperSpacerY = tooltipOffset.height + 50

            const onTop = MapController.tt.position.y + tooltipWrapperSpacerY > windowOffset.top + windowOffset.height
            const onLeft = MapController.tt.position.x + tooltipWrapperSpacerX > windowOffset.width

            if (onTop) {
                MapController.tt.position.y -= 50
            }

            tooltipWrapper.classList.toggle('left', onLeft)
            tooltipWrapper.classList.toggle('top', onTop)
        })
    }

    const hideTooltip = function (event, coords) {
        if (!tooltipWrapper) {
            return
        }

        let villageHash = coords ? genVillageHash(coords) : currentVillageHash
        tooltipQueue[villageHash] = false
        allowTooltip = false
        MapController.tt.visible = false
        tooltipWrapper.classList.add('ng-hide')
        mapWrapper.appendChild(tooltipWrapper)
    }

    const openColorPalette = function (inputType, colorGroup, itemId) {
        let modalScope = $rootScope.$new()
        let selectedColor
        let hideReset = true
        let settingId

        modalScope.colorPalettes = colors.palette

        if (inputType === 'setting') {
            settingId = colorGroup
            selectedColor = settings.get(settingId)
            hideReset = false

            modalScope.submit = function () {
                $scope.settings[settingId] = '#' + modalScope.selectedColor
                modalScope.closeWindow()
            }

            modalScope.reset = function () {
                $scope.settings[settingId] = settings.getDefault(settingId)
                modalScope.closeWindow()
            }
        } else if (inputType === 'add_custom_highlight') {
            selectedColor = $scope.addHighlightColor

            modalScope.submit = function () {
                $scope.addHighlightColor = '#' + modalScope.selectedColor
                modalScope.closeWindow()
            }
        } else if (inputType === 'edit_custom_highlight') {
            selectedColor = $scope.highlights[colorGroup][itemId]

            modalScope.submit = function () {
                minimap.addHighlight({
                    id: itemId,
                    type: colorGroup
                }, modalScope.selectedColor)
                modalScope.closeWindow()
            }
        }

        modalScope.selectedColor = selectedColor.replace('#', '')
        modalScope.hasCustomColors = true
        modalScope.hideReset = hideReset

        modalScope.finishAction = function ($event, color) {
            modalScope.selectedColor = color
        }

        windowManagerService.getModal('modal_color_palette', modalScope)
    }

    const addCustomHighlight = function () {
        minimap.addHighlight($scope.selectedHighlight, $scope.addHighlightColor)
    }

    const saveSettings = function () {
        settings.setAll(settings.decode($scope.settings))
        utils.notif('success', $filter('i18n')('settings_saved', $rootScope.loc.ale, 'minimap'))
    }

    const resetSettings = function () {
        let modalScope = $rootScope.$new()

        modalScope.title = $filter('i18n')('reset_confirm_title', $rootScope.loc.ale, 'minimap')
        modalScope.text = $filter('i18n')('reset_confirm_text', $rootScope.loc.ale, 'minimap')
        modalScope.submitText = $filter('i18n')('reset', $rootScope.loc.ale, 'common')
        modalScope.cancelText = $filter('i18n')('cancel', $rootScope.loc.ale, 'common')
        modalScope.showQuestionMarkIcon = true
        modalScope.switchColors = true

        modalScope.submit = function submit() {
            settings.resetAll()
            utils.notif('success', $filter('i18n')('settings_reset', $rootScope.loc.ale, 'minimap'))
            modalScope.closeWindow()
        }

        modalScope.cancel = function cancel() {
            modalScope.closeWindow()
        }

        windowManagerService.getModal('modal_attention', modalScope)
    }

    const highlightsCount = function () {
        const character = Object.keys($scope.highlights.character).length
        const tribe = Object.keys($scope.highlights.tribe).length
        
        return character + tribe
    }

    const openProfile = function (type, itemId) {
        const handler = type === 'character'
            ? windowDisplayService.openCharacterProfile
            : windowDisplayService.openTribeProfile

        handler(itemId)
    }

    const eventHandlers = {
        addHighlightAutoCompleteSelect: function (item) {
            $scope.selectedHighlight = {
                id: item.id,
                type: item.type,
                name: item.name
            }
        },
        highlightUpdate: function () {
            updateHighlightNames()
        },
        highlightAddErrorExists: function () {
            utils.notif('error', $filter('i18n')('highlight_add_error_exists', $rootScope.loc.ale, 'minimap'))
        },
        highlightAddErrorNoEntry: function () {
            utils.notif('error', $filter('i18n')('highlight_add_error_no_entry', $rootScope.loc.ale, 'minimap'))
        },
        highlightAddErrorInvalidColor: function () {
            utils.notif('error', $filter('i18n')('highlight_add_error_invalid_color', $rootScope.loc.ale, 'minimap'))
        },
        onMouseLeaveMinimap: function () {
            hideTooltip()

            $viewportRefCanvas.dispatchEvent(new MouseEvent('mouseup', {
                view: window,
                bubbles: true,
                cancelable: true
            }))
        },
        onMouseMoveMinimap: function () {
            hideTooltip()

            $viewportRefCanvas.style.cursor = 'url(' + cdn.getPath('/img/cursor/grab_pushed.png') + '), move'
        },
        onMouseStopMoveMinimap: function () {
            $viewportRefCanvas.style.cursor = ''
        }
    }

    const init = function () {
        settings = minimap.getSettings()
        MapController = transferredSharedDataService.getSharedData('MapController')
        $minimapCanvas = document.createElement('canvas')
        $minimapCanvas.className = 'minimap'
        $viewportRefCanvas = document.createElement('canvas')
        $viewportRefCanvas.className = 'cross'

        minimap.setViewport($minimapCanvas)
        minimap.setViewportRef($viewportRefCanvas)

        tooltipWrapper = document.querySelector('#map-tooltip')
        windowWrapper = document.querySelector('#wrapper')
        mapWrapper = document.querySelector('#map')

        $button = interfaceOverflow.addMenuButton4('Minimapa', 20)
        $button.addEventListener('click', function () {
            const current = minimap.getMapPosition()

            if (!current) {
                return false
            }

            buildWindow()
            minimap.setCurrentPosition(current.x, current.y)
        })

        interfaceOverflow.addTemplate('twoverflow_minimap_window', `<div id=\"two-minimap\" class=\"win-content two-window\"><header class=\"win-head\"><h2>Minimapa</h2><ul class=\"list-btn\"><li><a href=\"#\" class=\"size-34x34 btn-red icon-26x26-close\" ng-click=\"closeWindow()\"></a></ul></header><div class=\"win-main small-select\" scrollbar=\"\"><div class=\"tabs tabs-bg\"><div class=\"tabs-three-col\"><div class=\"tab\" ng-click=\"selectTab(TAB_TYPES.MINIMAP)\" ng-class=\"{'tab-active': selectedTab == TAB_TYPES.MINIMAP}\"><div class=\"tab-inner\"><div ng-class=\"{'box-border-light': selectedTab === TAB_TYPES.MINIMAP}\"><a href=\"#\" ng-class=\"{'btn-icon btn-orange': selectedTab !== TAB_TYPES.MINIMAP}\">{{ 'minimap' | i18n:loc.ale:'minimap' }}</a></div></div></div><div class=\"tab\" ng-click=\"selectTab(TAB_TYPES.HIGHLIGHTS)\" ng-class=\"{'tab-active': selectedTab == TAB_TYPES.HIGHLIGHTS}\"><div class=\"tab-inner\"><div ng-class=\"{'box-border-light': selectedTab === TAB_TYPES.HIGHLIGHTS}\"><a href=\"#\" ng-class=\"{'btn-icon btn-orange': selectedTab !== TAB_TYPES.HIGHLIGHTS}\">{{ 'highlights' | i18n:loc.ale:'minimap' }}</a></div></div></div><div class=\"tab\" ng-click=\"selectTab(TAB_TYPES.SETTINGS)\" ng-class=\"{'tab-active': selectedTab == TAB_TYPES.SETTINGS}\"><div class=\"tab-inner\"><div ng-class=\"{'box-border-light': selectedTab === TAB_TYPES.SETTINGS}\"><a href=\"#\" ng-class=\"{'btn-icon btn-orange': selectedTab !== TAB_TYPES.SETTINGS}\">{{ 'settings' | i18n:loc.ale:'common' }}</a></div></div></div></div></div><div ng-show=\"selectedTab === TAB_TYPES.MINIMAP\" class=\"minimap-container\"></div><div class=\"box-paper\" ng-class=\"{'footer': selectedTab == TAB_TYPES.SETTINGS}\"><div class=\"scroll-wrap\"><div ng-show=\"selectedTab == TAB_TYPES.HIGHLIGHTS\"><h5 class=\"twx-section\">{{ 'add' | i18n:loc.ale:'minimap' }}</h5><table class=\"tbl-border-light tbl-striped add-highlight\"><col width=\"40%\"><col><col width=\"4%\"><col width=\"4%\"><tr><td><div auto-complete=\"autoComplete\"></div><td class=\"text-center\"><span ng-show=\"selectedHighlight\" class=\"icon-26x26-rte-{{ selectedHighlight.type }}\"></span> {{ selectedHighlight.name }}<td><div class=\"color-container box-border-dark\" ng-click=\"openColorPalette('add_custom_highlight')\" ng-style=\"{'background-color': addHighlightColor }\" tooltip=\"\" tooltip-content=\"{{ 'tooltip_pick_color' | i18n:loc.ale:'minimap' }}\"></div><td><span class=\"btn-orange icon-26x26-plus\" ng-click=\"addCustomHighlight()\" tooltip=\"\" tooltip-content=\"{{ 'add' | i18n:loc.ale:'minimap' }}\"></span></table><h5 class=\"twx-section\">{{ TAB_TYPES.HIGHLIGHTS | i18n:loc.ale:'minimap' }}</h5><p class=\"text-center\" ng-show=\"!highlightsCount()\">{{ 'no_highlights' | i18n:loc.ale:'minimap' }}<table class=\"highlights tbl-border-light tbl-striped\" ng-show=\"highlightsCount()\"><col width=\"4%\"><col><col width=\"4%\"><col width=\"4%\"><tr ng-repeat=\"(id, color) in highlights.character\"><td><span class=\"icon-26x26-rte-character\"></span><td><span class=\"open-profile\" ng-click=\"openProfile('character', id)\">{{ highlightNames.character[id] }}</span><td><div class=\"color-container box-border-dark\" ng-click=\"openColorPalette('edit_custom_highlight', 'character', id)\" ng-style=\"{'background-color': color }\"></div><td><a class=\"size-26x26 btn-red icon-20x20-close\" ng-click=\"removeHighlight('character', id)\" tooltip=\"\" tooltip-content=\"{{ 'remove' | i18n:loc.ale:'minimap' }}\"></a><tr ng-repeat=\"(id, color) in highlights.tribe\"><td><span class=\"icon-26x26-rte-tribe\"></span><td><span class=\"open-profile\" ng-click=\"openProfile('tribe', id)\">{{ highlightNames.tribe[id] }}</span><td><div class=\"color-container box-border-dark\" ng-click=\"openColorPalette('edit_custom_highlight', 'tribe', id)\" ng-style=\"{'background-color': color }\"></div><td><a class=\"size-26x26 btn-red icon-20x20-close\" ng-click=\"removeHighlight('tribe', id)\" tooltip=\"\" tooltip-content=\"{{ 'remove' | i18n:loc.ale:'minimap' }}\"></a></table></div><div class=\"settings\" ng-show=\"selectedTab == TAB_TYPES.SETTINGS\"><table class=\"tbl-border-light tbl-striped\"><col width=\"60%\"><col><col width=\"56px\"><tr><th colspan=\"3\">{{ 'misc' | i18n:loc.ale:'minimap' }}<tr><td>{{ 'settings_map_size' | i18n:loc.ale:'minimap' }}<td colspan=\"3\"><div select=\"\" list=\"mapSizes\" selected=\"settings[SETTINGS.MAP_SIZE]\" drop-down=\"true\"></div><tr><td>{{ 'settings_right_click_action' | i18n:loc.ale:'minimap' }}<td colspan=\"3\"><div select=\"\" list=\"actionTypes\" selected=\"settings[SETTINGS.RIGHT_CLICK_ACTION]\" drop-down=\"true\"></div><tr><td colspan=\"2\">{{ 'settings_show_view_reference' | i18n:loc.ale:'minimap' }}<td><div switch-slider=\"\" value=\"settings[SETTINGS.SHOW_VIEW_REFERENCE]\" vertical=\"false\" size=\"'56x28'\" enabled=\"true\"></div><tr><td colspan=\"2\">{{ 'settings_show_continent_demarcations' | i18n:loc.ale:'minimap' }}<td><div switch-slider=\"\" value=\"settings[SETTINGS.SHOW_CONTINENT_DEMARCATIONS]\" vertical=\"false\" size=\"'56x28'\" enabled=\"true\"></div><tr><td colspan=\"2\">{{ 'settings_show_province_demarcations' | i18n:loc.ale:'minimap' }}<td><div switch-slider=\"\" value=\"settings[SETTINGS.SHOW_PROVINCE_DEMARCATIONS]\" vertical=\"false\" size=\"'56x28'\" enabled=\"true\"></div><tr><td colspan=\"2\">{{ 'settings_show_barbarians' | i18n:loc.ale:'minimap' }}<td><div switch-slider=\"\" value=\"settings[SETTINGS.SHOW_BARBARIANS]\" vertical=\"false\" size=\"'56x28'\" enabled=\"true\"></div><tr><td colspan=\"2\">{{ 'settings_show_only_custom_highlights' | i18n:loc.ale:'minimap' }}<td><div switch-slider=\"\" value=\"settings[SETTINGS.SHOW_ONLY_CUSTOM_HIGHLIGHTS]\" vertical=\"false\" size=\"'56x28'\" enabled=\"true\"></div><tr><td colspan=\"2\">{{ 'settings_highlight_own' | i18n:loc.ale:'minimap' }}<td><div switch-slider=\"\" value=\"settings[SETTINGS.HIGHLIGHT_OWN]\" vertical=\"false\" size=\"'56x28'\" enabled=\"true\"></div><tr><td colspan=\"2\">{{ 'settings_highlight_selected' | i18n:loc.ale:'minimap' }}<td><div switch-slider=\"\" value=\"settings[SETTINGS.HIGHLIGHT_SELECTED]\" vertical=\"false\" size=\"'56x28'\" enabled=\"true\"></div><tr><td colspan=\"2\">{{ 'settings_highlight_diplomacy' | i18n:loc.ale:'minimap' }}<td><div switch-slider=\"\" value=\"settings[SETTINGS.HIGHLIGHT_DIPLOMACY]\" vertical=\"false\" size=\"'56x28'\" enabled=\"true\"></div></table><table class=\"tbl-border-light tbl-striped\"><col><col width=\"29px\"><tr><th colspan=\"2\">{{ 'colors_misc' | i18n:loc.ale:'minimap' }}<tr><td>{{ 'settings_colors_background' | i18n:loc.ale:'minimap' }}<td><div class=\"color-container box-border-dark\" ng-click=\"openColorPalette('setting', SETTINGS.COLOR_BACKGROUND)\" ng-style=\"{'background-color': settings[SETTINGS.COLOR_BACKGROUND] }\"></div><tr><td>{{ 'settings_colors_province' | i18n:loc.ale:'minimap' }}<td><div class=\"color-container box-border-dark\" ng-click=\"openColorPalette('setting', SETTINGS.COLOR_PROVINCE)\" ng-style=\"{'background-color': settings[SETTINGS.COLOR_PROVINCE] }\"></div><tr><td>{{ 'settings_colors_continent' | i18n:loc.ale:'minimap' }}<td><div class=\"color-container box-border-dark\" ng-click=\"openColorPalette('setting', SETTINGS.COLOR_CONTINENT)\" ng-style=\"{'background-color': settings[SETTINGS.COLOR_CONTINENT] }\"></div><tr><td>{{ 'settings_colors_view_reference' | i18n:loc.ale:'minimap' }}<td><div class=\"color-container box-border-dark\" ng-click=\"openColorPalette('setting', SETTINGS.COLOR_VIEW_REFERENCE)\" ng-style=\"{'background-color': settings[SETTINGS.COLOR_VIEW_REFERENCE] }\"></div><tr><td>{{ 'settings_colors_quick_highlight' | i18n:loc.ale:'minimap' }}<td><div class=\"color-container box-border-dark\" ng-click=\"openColorPalette('setting', SETTINGS.COLOR_QUICK_HIGHLIGHT)\" ng-style=\"{'background-color': settings[SETTINGS.COLOR_QUICK_HIGHLIGHT] }\"></div></table><p class=\"text-center\">{{ 'default_village_colors_info'| i18n:loc.ale:'minimap' }}</div></div></div></div><footer class=\"win-foot\" ng-show=\"selectedTab === TAB_TYPES.SETTINGS\"><ul class=\"list-btn list-center\"><li><a href=\"#\" class=\"btn-border btn-red\" ng-click=\"resetSettings()\">{{ 'reset' | i18n:loc.ale:'common' }}</a><li><a href=\"#\" class=\"btn-border btn-green\" ng-click=\"saveSettings()\">{{ 'save' | i18n:loc.ale:'common' }}</a></ul></footer></div>`)
        interfaceOverflow.addStyle('#map-tooltip{z-index:1000}#two-minimap .minimap{position:absolute;left:0;top:38px;z-index:5}#two-minimap .cross{position:absolute;left:0;top:38px;z-index:6}#two-minimap .box-paper:not(.footer) .scroll-wrap{margin-bottom:40px}#two-minimap span.select-wrapper{width:100%}#two-minimap .add-highlight input{width:100%}#two-minimap .open-profile{font-weight:500;color:#5d3b17;padding:0 5px}#two-minimap .open-profile:hover{text-shadow:-1px 1px 0 #e0cc97}#two-minimap .settings td:first-child{padding:0 5px}#two-minimap .highlights .color-container{margin:1px}')
    }

    const buildWindow = function () {
        $scope = $rootScope.$new()
        $scope.SETTINGS = SETTINGS
        $scope.TAB_TYPES = TAB_TYPES
        $scope.selectedTab = DEFAULT_TAB
        $scope.selectedHighlight = false
        $scope.addHighlightColor = '#000000'
        $scope.highlights = minimap.getHighlights()
        $scope.highlightNames = highlightNames
        $scope.mapSizes = Settings.encodeList(MAP_SIZE_TYPES, {
            textObject: 'minimap',
            disabled: false
        })
        $scope.actionTypes = Settings.encodeList(ACTION_TYPES, {
            textObject: 'minimap',
            disabled: false
        })
        $scope.autoComplete = {
            type: ['character', 'tribe'],
            placeholder: $filter('i18n')('placeholder_search', $rootScope.loc.ale, 'minimap'),
            onEnter: eventHandlers.addHighlightAutoCompleteSelect
        }

        // functions
        $scope.selectTab = selectTab
        $scope.openColorPalette = openColorPalette
        $scope.addCustomHighlight = addCustomHighlight
        $scope.removeHighlight = minimap.removeHighlight
        $scope.saveSettings = saveSettings
        $scope.resetSettings = resetSettings
        $scope.highlightsCount = highlightsCount
        $scope.openProfile = openProfile

        settings.injectScope($scope, {
            textObject: 'minimap'
        })

        let eventScope = new EventScope('twoverflow_minimap_window', function onClose () {
            minimap.disableRendering()
        })

        eventScope.register(eventTypeProvider.GROUPS_VILLAGES_CHANGED, eventHandlers.highlightUpdate, true)
        eventScope.register(eventTypeProvider.MINIMAP_HIGHLIGHT_ADD_ERROR_EXISTS, eventHandlers.highlightAddErrorExists)
        eventScope.register(eventTypeProvider.MINIMAP_HIGHLIGHT_ADD_ERROR_NO_ENTRY, eventHandlers.highlightAddErrorNoEntry)
        eventScope.register(eventTypeProvider.MINIMAP_HIGHLIGHT_ADD_ERROR_INVALID_COLOR, eventHandlers.highlightAddErrorInvalidColor)
        eventScope.register(eventTypeProvider.MINIMAP_VILLAGE_HOVER, showTooltip)
        eventScope.register(eventTypeProvider.MINIMAP_VILLAGE_BLUR, hideTooltip)
        eventScope.register(eventTypeProvider.MINIMAP_MOUSE_LEAVE, eventHandlers.onMouseLeaveMinimap)
        eventScope.register(eventTypeProvider.MINIMAP_START_MOVE, eventHandlers.onMouseMoveMinimap)
        eventScope.register(eventTypeProvider.MINIMAP_STOP_MOVE, eventHandlers.onMouseStopMoveMinimap)

        windowManagerService.getScreenWithInjectedScope('!twoverflow_minimap_window', $scope)
        updateHighlightNames()
        appendCanvas()
        minimap.enableRendering()

        if (minimap.isFirstDraw()) {
            minimap.drawMinimap()
        }
    }

    return init
})

define('two/minimap/settings', [], function () {
    return {
        MAP_SIZE: 'map_size',
        RIGHT_CLICK_ACTION: 'right_click_action',
        FLOATING_MINIMAP: 'floating_minimap',
        SHOW_VIEW_REFERENCE: 'show_view_reference',
        SHOW_CONTINENT_DEMARCATIONS: 'show_continent_demarcations',
        SHOW_PROVINCE_DEMARCATIONS: 'show_province_demarcations',
        SHOW_BARBARIANS: 'show_barbarians',
        SHOW_ONLY_CUSTOM_HIGHLIGHTS: 'show_only_custom_highlights',
        HIGHLIGHT_OWN: 'highlight_own',
        HIGHLIGHT_SELECTED: 'highlight_selected',
        HIGHLIGHT_DIPLOMACY: 'highlight_diplomacy',
        COLOR_GHOST: 'color_ghost',
        COLOR_QUICK_HIGHLIGHT: 'color_quick_highlight',
        COLOR_BACKGROUND: 'color_background',
        COLOR_PROVINCE: 'color_province',
        COLOR_CONTINENT: 'color_continent',
        COLOR_VIEW_REFERENCE: 'color_view_reference'
    }
})

define('two/minimap/settings/updates', function () {
    return {
        MINIMAP: 'minimap',
        MAP_POSITION: 'map_position'
    }
})

define('two/minimap/settings/map', [
    'two/minimap/settings',
    'two/minimap/types/actions',
    'two/minimap/types/mapSizes',
    'two/minimap/settings/updates'
], function (
    SETTINGS,
    ACTION_TYPES,
    MAP_SIZES,
    UPDATES
) {
    return {
        [SETTINGS.MAP_SIZE]: {
            default: MAP_SIZES.SMALL,
            inputType: 'select',
            updates: [UPDATES.MINIMAP, UPDATES.MAP_POSITION],
            disabledOption: false
        },
        [SETTINGS.RIGHT_CLICK_ACTION]: {
            default: ACTION_TYPES.HIGHLIGHT_PLAYER,
            inputType: 'select',
            disabledOption: false
        },
        [SETTINGS.SHOW_VIEW_REFERENCE]: {
            default: true,
            inputType: 'checkbox',
            updates: [UPDATES.MINIMAP]
        },
        [SETTINGS.SHOW_CONTINENT_DEMARCATIONS]: {
            default: false,
            inputType: 'checkbox',
            updates: [UPDATES.MINIMAP]
        },
        [SETTINGS.SHOW_PROVINCE_DEMARCATIONS]: {
            default: true,
            inputType: 'checkbox',
            updates: [UPDATES.MINIMAP]
        },
        [SETTINGS.SHOW_BARBARIANS]: {
            default: false,
            inputType: 'checkbox',
            updates: [UPDATES.MINIMAP]
        },
        [SETTINGS.SHOW_ONLY_CUSTOM_HIGHLIGHTS]: {
            default: false,
            inputType: 'checkbox',
            updates: [UPDATES.MINIMAP]
        },
        [SETTINGS.HIGHLIGHT_OWN]: {
            default: true,
            inputType: 'checkbox',
            updates: [UPDATES.MINIMAP]
        },
        [SETTINGS.HIGHLIGHT_SELECTED]: {
            default: true,
            inputType: 'checkbox',
            updates: [UPDATES.MINIMAP]
        },
        [SETTINGS.HIGHLIGHT_DIPLOMACY]: {
            default: true,
            inputType: 'checkbox',
            updates: [UPDATES.MINIMAP]
        },
        [SETTINGS.COLOR_SELECTED]: {
            default: '#ffffff',
            inputType: 'color',
            updates: [UPDATES.MINIMAP]
        },
        [SETTINGS.COLOR_BARBARIAN]: {
            default: '#969696',
            inputType: 'color',
            updates: [UPDATES.MINIMAP]
        },
        [SETTINGS.COLOR_PLAYER]: {
            default: '#f0c800',
            inputType: 'color',
            updates: [UPDATES.MINIMAP]
        },
        [SETTINGS.COLOR_QUICK_HIGHLIGHT]: {
            default: '#ffffff',
            inputType: 'color',
            updates: [UPDATES.MINIMAP]
        },
        [SETTINGS.COLOR_BACKGROUND]: {
            default: '#436213',
            inputType: 'color',
            updates: [UPDATES.MINIMAP]
        },
        [SETTINGS.COLOR_PROVINCE]: {
            default: '#74c374',
            inputType: 'color',
            updates: [UPDATES.MINIMAP]
        },
        [SETTINGS.COLOR_CONTINENT]: {
            default: '#74c374',
            inputType: 'color',
            updates: [UPDATES.MINIMAP]
        },
        [SETTINGS.COLOR_VIEW_REFERENCE]: {
            default: '#999999',
            inputType: 'color',
            updates: [UPDATES.MINIMAP]
        },
        [SETTINGS.COLOR_TRIBE]: {
            default: '#0000DB',
            inputType: 'color',
            updates: [UPDATES.MINIMAP]
        },
        [SETTINGS.COLOR_ALLY]: {
            default: '#00a0f4',
            inputType: 'color',
            updates: [UPDATES.MINIMAP]
        },
        [SETTINGS.COLOR_ENEMY]: {
            default: '#ED1212',
            inputType: 'color',
            updates: [UPDATES.MINIMAP]
        },
        [SETTINGS.COLOR_FRIENDLY]: {
            default: '#BF4DA4',
            inputType: 'color',
            updates: [UPDATES.MINIMAP]
        },
        [SETTINGS.COLOR_GHOST]: {
            default: '#3E551C',
            inputType: 'color',
            updates: [UPDATES.MINIMAP]
        }
    }
})

define('two/minimap/types/actions', [], function () {
    return {
        HIGHLIGHT_PLAYER: 'highlight_player',
        HIGHLIGHT_TRIBE: 'highlight_tribe'
    }
})

define('two/minimap/types/mapSizes', [], function () {
    return {
        VERY_SMALL: 'very_small',
        SMALL: 'small',
        BIG: 'big',
        VERY_BIG: 'very_big'
    }
})

require([
    'two/ready',
    'two/minimap',
    'two/minimap/ui',
    'two/minimap/events',
    'two/minimap/types/actions',
    'two/minimap/settings',
    'two/minimap/settings/updates',
    'two/minimap/settings/map'
], function (
    ready,
    minimap,
    minimapInterface
) {
    if (minimap.initialized) {
        return false
    }

    ready(function () {
        minimap.init()
        minimapInterface()
        minimap.run()
    }, 'map')
})

define('two/mintHelper', [
    'queues/EventQueue'
], function(
    eventQueue
) {
    let initialized = false
    let running = false
    let interval = 3000
	
    function mintCoins() {
        let player = modelDataService.getSelectedCharacter()
        let villages = player.getVillageList()
        villages.forEach(function(village) {
            let amountWood = 0
            let amountClay = 0
            let amountIron = 0
            let data = village.data
            let buildings = data.buildings
            let academy = buildings.academy
            let level = academy.level
            let resources = village.getResources()
            let computed = resources.getComputed()
            let wood = computed.wood
            let clay = computed.clay
            let iron = computed.iron
            let villageWood = wood.currentStock
            let villageClay = clay.currentStock
            let villageIron = iron.currentStock
            let woodCost = 28000
            let clayCost = 30000
            let ironCost = 25000
            setTimeout(function() {
                if (level > 0) {
                    if (villageWood >= woodCost && villageClay >= clayCost && villageIron >= ironCost) {
                        amountWood = Math.floor(villageWood / woodCost)
                        amountClay = Math.floor(villageClay / clayCost)
                        amountIron = Math.floor(villageIron / ironCost)
                        if (amountWood <= amountIron && amountWood <= amountClay) {
                            socketService.emit(routeProvider.MINT_COINS, {
                                village_id: village.getId(),
                                amount: amountWood
                            })
                            console.log('W wiosce ' + village.getName() + ' wybito ' + amountWood + ' monet.')
                        } else if (amountClay <= amountIron && amountClay <= amountWood) {
                            socketService.emit(routeProvider.MINT_COINS, {
                                village_id: village.getId(),
                                amount: amountClay
                            })
                            console.log('W wiosce ' + village.getName() + ' wybito ' + amountClay + ' monet.')
                        } else {
                            socketService.emit(routeProvider.MINT_COINS, {
                                village_id: village.getId(),
                                amount: amountIron
                            })
                            console.log('W wiosce ' + village.getName() + ' wybito ' + amountIron + ' monet.')
                        }
                    } else {
                        console.log('Za mało surowców żeby wybić monety w wiosce' + village.getName())
                    }
                } else {
                    console.log('W wiosce ' + village.getName() + ' brak akademi')
                }
            }, interval)
        })
        setTimeout(mintCoins, 30000)
    }
    let mintHelper = {}
    mintHelper.init = function() {
        initialized = true
    }
    mintHelper.start = function() {
        eventQueue.trigger(eventTypeProvider.MINT_HELPER_STARTED)
        running = true
        mintCoins()
    }
    mintHelper.stop = function() {
        eventQueue.trigger(eventTypeProvider.MINT_HELPER_STOPPED)
        running = false
    }
    mintHelper.isRunning = function() {
        return running
    }
    mintHelper.isInitialized = function() {
        return initialized
    }
    return mintHelper
})
define('two/mintHelper/events', [], function () {
    angular.extend(eventTypeProvider, {
        MINT_HELPER_STARTED: 'mint_helper_started',
        MINT_HELPER_STOPPED: 'mint_helper_stopped'
    })
})

define('two/mintHelper/ui', [
    'two/ui',
    'two/mintHelper',
    'two/utils',
    'queues/EventQueue'
], function (
    interfaceOverflow,
    mintHelper,
    utils,
    eventQueue
) {
    let $button

    const init = function () {
        $button = interfaceOverflow.addMenuButton2('Mincerz', 40, $filter('i18n')('description', $rootScope.loc.ale, 'mint_helper'))
        
        $button.addEventListener('click', function () {
            if (mintHelper.isRunning()) {
                mintHelper.stop()
                utils.notif('success', $filter('i18n')('deactivated', $rootScope.loc.ale, 'mint_helper'))
            } else {
                mintHelper.start()
                utils.notif('success', $filter('i18n')('activated', $rootScope.loc.ale, 'mint_helper'))
            }
        })

        eventQueue.register(eventTypeProvider.MINT_HELPER_STARTED, function () {
            $button.classList.remove('btn-orange')
            $button.classList.add('btn-red')
        })

        eventQueue.register(eventTypeProvider.MINT_HELPER_STOPPED, function () {
            $button.classList.remove('btn-red')
            $button.classList.add('btn-orange')
        })

        if (mintHelper.isRunning()) {
            eventQueue.trigger(eventTypeProvider.MINT_HELPER_STARTED)
        }

        return opener
    }

    return init
})

require([
    'two/ready',
    'two/mintHelper',
    'two/mintHelper/ui',
    'Lockr',
    'queues/EventQueue',
    'two/mintHelper/events'
], function(
    ready,
    mintHelper,
    mintHelperInterface,
    Lockr,
    eventQueue
) {
    const STORAGE_KEYS = {
        ACTIVE: 'mint_helper_active'
    }
	
    if (mintHelper.isInitialized()) {
        return false
    }
    ready(function() {
        mintHelper.init()
        mintHelperInterface()

        ready(function() {
            if (Lockr.get(STORAGE_KEYS.ACTIVE, false, true)) {
                mintHelper.start()
            }

            eventQueue.register(eventTypeProvider.AUTO_HELPER_STARTED, function() {
                Lockr.set(STORAGE_KEYS.ACTIVE, true)
            })

            eventQueue.register(eventTypeProvider.AUTO_HELPER_STOPPED, function() {
                Lockr.set(STORAGE_KEYS.ACTIVE, false)
            })
        }, ['initial_village'])
    })
})
define('two/prankHelper', [
    'two/Settings',
    'two/prankHelper/settings',
    'two/prankHelper/settings/map',
    'two/prankHelper/settings/updates',
    'two/ready',
    'queues/EventQueue'
], function (
    Settings,
    SETTINGS,
    SETTINGS_MAP,
    UPDATES,
    ready,
    eventQueue
) {
    let initialized = false
    let running = false
    let settings
    let prankHelperSettings

    let selectedPresets = []
    let selectedGroups = []

    const STORAGE_KEYS = {
        SETTINGS: 'prank_helper_settings'
    }

    const updatePresets = function () {
        selectedPresets = []

        const allPresets = modelDataService.getPresetList().getPresets()
        const presetsSelectedByTheUser = prankHelperSettings[SETTINGS.PRESETS]

        presetsSelectedByTheUser.forEach(function (presetId) {
            selectedPresets.push(allPresets[presetId])
        })

        console.log('selectedPresets', selectedPresets)
    }

    const updateGroups = function () {
        selectedGroups = []

        const allGroups = modelDataService.getGroupList().getGroups()
        const groupsSelectedByTheUser = prankHelperSettings[SETTINGS.GROUPS]

        groupsSelectedByTheUser.forEach(function (groupId) {
            selectedGroups.push(allGroups[groupId])
        })

        console.log('selectedGroups', selectedGroups)
    }

    const examplePublicFunctions = {}

    examplePublicFunctions.init = function () {
        initialized = true

        settings = new Settings({
            settingsMap: SETTINGS_MAP,
            storageKey: STORAGE_KEYS.SETTINGS
        })

        settings.onChange(function (changes, updates) {
            prankHelperSettings = settings.getAll()

            // here you can handle settings that get modified and need
            // some processing. Useful to not break the script when updated
            // while running.

            if (updates[UPDATES.PRESETS]) {
                updatePresets()
            }

            if (updates[UPDATES.GROUPS]) {
                updateGroups()
            }
        })

        prankHelperSettings = settings.getAll()

        console.log('all settings', prankHelperSettings)

        ready(function () {
            updatePresets()
        }, 'presets')

        $rootScope.$on(eventTypeProvider.ARMY_PRESET_UPDATE, updatePresets)
        $rootScope.$on(eventTypeProvider.ARMY_PRESET_DELETED, updatePresets)
        $rootScope.$on(eventTypeProvider.GROUPS_CREATED, updateGroups)
        $rootScope.$on(eventTypeProvider.GROUPS_DESTROYED, updateGroups)
        $rootScope.$on(eventTypeProvider.GROUPS_UPDATED, updateGroups)
    }

    examplePublicFunctions.start = function () {
        running = true

        console.log('selectedPresets', selectedPresets)
        console.log('selectedGroups', selectedGroups)

        eventQueue.trigger(eventTypeProvider.PRANK_HELPER_START)
    }

    examplePublicFunctions.stop = function () {
        running = false

        console.log('example module stop')

        eventQueue.trigger(eventTypeProvider.PRANK_HELPER_STOP)
    }

    examplePublicFunctions.getSettings = function () {
        return settings
    }

    examplePublicFunctions.isInitialized = function () {
        return initialized
    }

    examplePublicFunctions.isRunning = function () {
        return running
    }

    return examplePublicFunctions
})

define('two/prankHelper/events', [], function () {
    angular.extend(eventTypeProvider, {
        PRANK_HELPER_START: 'prank_helper_start',
        PRANK_HELPER_STOP: 'prank_helper_stop'
    })
})

define('two/prankHelper/ui', [
    'two/ui',
    'two/prankHelper',
    'two/prankHelper/settings',
    'two/prankHelper/settings/map',
    'two/Settings',
    'two/EventScope',
    'two/utils'
], function (
    interfaceOverflow,
    prankHelper,
    SETTINGS,
    SETTINGS_MAP,
    Settings,
    EventScope,
    utils
) {
    let $scope
    let settings
    let presetList = modelDataService.getPresetList()
    let groupList = modelDataService.getGroupList()
    let $button
    
    const TAB_TYPES = {
        SETTINGS: 'settings',
        SOME_VIEW: 'some_view'
    }

    const selectTab = function (tabType) {
        $scope.selectedTab = tabType
    }

    const saveSettings = function () {
        settings.setAll(settings.decode($scope.settings))

        utils.notif('success', 'Settings saved')
    }

    const switchState = function () {
        if (prankHelper.isRunning()) {
            prankHelper.stop()
        } else {
            prankHelper.start()
        }
    }

    const eventHandlers = {
        updatePresets: function () {
            $scope.presets = Settings.encodeList(presetList.getPresets(), {
                disabled: false,
                type: 'presets'
            })
        },
        updateGroups: function () {
            $scope.groups = Settings.encodeList(groupList.getGroups(), {
                disabled: false,
                type: 'groups'
            })
        },
        start: function () {
            $scope.running = true

            $button.classList.remove('btn-orange')
            $button.classList.add('btn-red')

            utils.notif('success', 'Example module started')
        },
        stop: function () {
            $scope.running = false

            $button.classList.remove('btn-red')
            $button.classList.add('btn-orange')

            utils.notif('success', 'Example module stopped')
        }
    }

    const init = function () {
        settings = prankHelper.getSettings()
        $button = interfaceOverflow.addMenuButton3('Błazen', 60)
        $button.addEventListener('click', buildWindow)

        interfaceOverflow.addTemplate('twoverflow_prank_helper_window', `<div id=\"two-example-module\" class=\"win-content two-window\"><header class=\"win-head\"><h2>Example Module</h2><ul class=\"list-btn\"><li><a href=\"#\" class=\"size-34x34 btn-red icon-26x26-close\" ng-click=\"closeWindow()\"></a></ul></header><div class=\"win-main\" scrollbar=\"\"><div class=\"tabs tabs-bg\"><div class=\"tabs-two-col\"><div class=\"tab\" ng-click=\"selectTab(TAB_TYPES.SETTINGS)\" ng-class=\"{'tab-active': selectedTab == TAB_TYPES.SETTINGS}\"><div class=\"tab-inner\"><div ng-class=\"{'box-border-light': selectedTab === TAB_TYPES.SETTINGS}\"><a href=\"#\" ng-class=\"{'btn-icon btn-orange': selectedTab !== TAB_TYPES.SETTINGS}\">{{ TAB_TYPES.SETTINGS | i18n:loc.ale:'common' }}</a></div></div></div><div class=\"tab\" ng-click=\"selectTab(TAB_TYPES.SOME_VIEW)\" ng-class=\"{'tab-active': selectedTab == TAB_TYPES.SOME_VIEW}\"><div class=\"tab-inner\"><div ng-class=\"{'box-border-light': selectedTab === TAB_TYPES.SOME_VIEW}\"><a href=\"#\" ng-class=\"{'btn-icon btn-orange': selectedTab !== TAB_TYPES.SOME_VIEW}\">{{ TAB_TYPES.SOME_VIEW | i18n:loc.ale:'exmaple_module' }}</a></div></div></div></div></div><div class=\"box-paper footer\"><div class=\"scroll-wrap\"><div class=\"settings\" ng-show=\"selectedTab === TAB_TYPES.SETTINGS\"><table class=\"tbl-border-light tbl-content tbl-medium-height\"><col><col width=\"200px\"><col width=\"60px\"><tr><th colspan=\"3\">{{ 'groups' | i18n:loc.ale:'example_module' }}<tr><td><span class=\"ff-cell-fix\">{{ 'presets' | i18n:loc.ale:'example_module' }}</span><td colspan=\"2\"><div select=\"\" list=\"presets\" selected=\"settings[SETTINGS.PRESETS]\" drop-down=\"true\"></div><tr><td><span class=\"ff-cell-fix\">{{ 'groups' | i18n:loc.ale:'example_module' }}</span><td colspan=\"2\"><div select=\"\" list=\"groups\" selected=\"settings[SETTINGS.GROUPS]\" drop-down=\"true\"></div><tr><td><span class=\"ff-cell-fix\">{{ 'some_number' | i18n:loc.ale:'example_module' }}</span><td><div range-slider=\"\" min=\"settingsMap[SETTINGS.SOME_NUMBER].min\" max=\"settingsMap[SETTINGS.SOME_NUMBER].max\" value=\"settings[SETTINGS.SOME_NUMBER]\" enabled=\"true\"></div><td class=\"cell-bottom\"><input class=\"fit textfield-border text-center\" ng-model=\"settings[SETTINGS.SOME_NUMBER]\"></table></div><div class=\"rich-text\" ng-show=\"selectedTab === TAB_TYPES.SOME_VIEW\"><h5 class=\"twx-section\">some view</h5></div></div></div></div><footer class=\"win-foot\"><ul class=\"list-btn list-center\"><li ng-show=\"selectedTab === TAB_TYPES.SETTINGS\"><a href=\"#\" class=\"btn-border btn-red\" ng-click=\"saveSettings()\">{{ 'save' | i18n:loc.ale:'common' }}</a><li ng-show=\"selectedTab === TAB_TYPES.SOME_VIEW\"><a href=\"#\" class=\"btn-border btn-orange\" ng-click=\"someViewAction()\">{{ 'some_view_action' | i18n:loc.ale:'example_module' }}</a><li><a href=\"#\" ng-class=\"{false:'btn-green', true:'btn-red'}[running]\" class=\"btn-border\" ng-click=\"switchState()\"><span ng-show=\"running\">{{ 'pause' | i18n:loc.ale:'common' }}</span> <span ng-show=\"!running\">{{ 'start' | i18n:loc.ale:'common' }}</span></a></ul></footer></div>`)
        interfaceOverflow.addStyle('#two-example-module div[select]{float:right}#two-example-module div[select] .select-handler{line-height:28px}#two-example-module .range-container{width:250px}#two-example-module .textfield-border{width:219px;height:34px;margin-bottom:2px;padding-top:2px}#two-example-module .textfield-border.fit{width:100%}')
    }

    const buildWindow = function () {
        $scope = $rootScope.$new()
        $scope.SETTINGS = SETTINGS
        $scope.TAB_TYPES = TAB_TYPES
        $scope.running = prankHelper.isRunning()
        $scope.selectedTab = TAB_TYPES.SETTINGS
        $scope.settingsMap = SETTINGS_MAP

        settings.injectScope($scope)
        eventHandlers.updatePresets()
        eventHandlers.updateGroups()

        $scope.selectTab = selectTab
        $scope.saveSettings = saveSettings
        $scope.switchState = switchState

        let eventScope = new EventScope('twoverflow_prank_helper_window', function onDestroy () {
            console.log('example window closed')
        })

        // all those event listeners will be destroyed as soon as the window gets closed
        eventScope.register(eventTypeProvider.ARMY_PRESET_UPDATE, eventHandlers.updatePresets, true /*true = native game event*/)
        eventScope.register(eventTypeProvider.ARMY_PRESET_DELETED, eventHandlers.updatePresets, true)
        eventScope.register(eventTypeProvider.GROUPS_CREATED, eventHandlers.updateGroups, true)
        eventScope.register(eventTypeProvider.GROUPS_DESTROYED, eventHandlers.updateGroups, true)
        eventScope.register(eventTypeProvider.GROUPS_UPDATED, eventHandlers.updateGroups, true)
        eventScope.register(eventTypeProvider.PRANK_HELPER_START, eventHandlers.start)
        eventScope.register(eventTypeProvider.PRANK_HELPER_STOP, eventHandlers.stop)
        
        windowManagerService.getScreenWithInjectedScope('!twoverflow_prank_helper_window', $scope)
    }

    return init
})

define('two/prankHelper/settings', [], function () {
    return {
        PRESETS: 'presets',
        GROUPS: 'groups',
        SOME_NUMBER: 'some_number'
    }
})

define('two/prankHelper/settings/updates', function () {
    return {
        PRESETS: 'presets',
        GROUPS: 'groups'
    }
})

define('two/prankHelper/settings/map', [
    'two/prankHelper/settings',
    'two/prankHelper/settings/updates'
], function (
    SETTINGS,
    UPDATES
) {
    return {
        [SETTINGS.PRESETS]: {
            default: [],
            updates: [
                UPDATES.PRESETS
            ],
            disabledOption: true,
            inputType: 'select',
            multiSelect: true,
            type: 'presets'
        },
        [SETTINGS.GROUPS]: {
            default: [],
            updates: [
                UPDATES.GROUPS,
            ],
            disabledOption: true,
            inputType: 'select',
            multiSelect: true,
            type: 'groups'
        },
        [SETTINGS.SOME_NUMBER]: {
            default: 60,
            inputType: 'number',
            min: 0,
            max: 120
        }
    }
})

require([
    'two/ready',
    'two/prankHelper',
    'two/prankHelper/ui',
    'two/prankHelper/events'
], function (
    ready,
    prankHelper,
    prankHelperInterface
) {
    if (prankHelper.isInitialized()) {
        return false
    }

    ready(function () {
        prankHelper.init()
        prankHelperInterface()
    })
})

define('two/presetCreator', [
    'queues/EventQueue',
    'two/utils'
], function(
    eventQueue,
    utils
) {
    var initialized = false
    var running = false
	
    var player = modelDataService.getSelectedCharacter()
    var villages = player.getVillageList()
    var pikinier = '060504'
    var miecznik = '060505'
    var topornik = '06050f'
    var łucznik = '060506'
    var lk = '060502'
    var łk = '060501'
    var ck = '060503'
    var partDeff = '05020a'
    var fullDeff = '05030a'
    var partOff = '04080a'
    var fullOff = '040a0a'
    var fejkpik = '070e04'
    var fejkmiecz = '070e05'
    var fejktop = '070e0f'
    var fejkłuk = '070e06'
    var fejklk = '070e02'
    var fejkłk = '070e01'
    var fejkck = '070e03'
    var fejktar = '070e07'
    var fejkkat = '070e0b'
    var fejktreb = '070e0e'
    var karetatar = '030d07'
    var karetakat = '030d0b'
    var karetatreb = '030d0e'

    function createPresets() {
        pikinier = typeof pikinier === 'string' ? parseInt(pikinier, 16) : pikinier
        miecznik = typeof miecznik === 'string' ? parseInt(miecznik, 16) : miecznik
        topornik = typeof topornik === 'string' ? parseInt(topornik, 16) : topornik
        łucznik = typeof łucznik === 'string' ? parseInt(łucznik, 16) : łucznik
        lk = typeof lk === 'string' ? parseInt(lk, 16) : lk
        łk = typeof łk === 'string' ? parseInt(łk, 16) : łk
        ck = typeof ck === 'string' ? parseInt(ck, 16) : ck
        partDeff = typeof partDeff === 'string' ? parseInt(partDeff, 16) : partDeff
        fullDeff = typeof fullDeff === 'string' ? parseInt(fullDeff, 16) : fullDeff
        partOff = typeof partOff === 'string' ? parseInt(partOff, 16) : partOff
        fullOff = typeof fullOff === 'string' ? parseInt(fullOff, 16) : fullOff
        fejkpik = typeof fejkpik === 'string' ? parseInt(fejkpik, 16) : fejkpik
        fejkmiecz = typeof fejkmiecz === 'string' ? parseInt(fejkmiecz, 16) : fejkmiecz
        fejktop = typeof fejktop === 'string' ? parseInt(fejktop, 16) : fejktop
        fejkłuk = typeof fejkłuk === 'string' ? parseInt(fejkłuk, 16) : fejkłuk
        fejklk = typeof fejklk === 'string' ? parseInt(fejklk, 16) : fejklk
        fejkłk = typeof fejkłk === 'string' ? parseInt(fejkłk, 16) : fejkłk
        fejkck = typeof fejkck === 'string' ? parseInt(fejkck, 16) : fejkck
        fejktar = typeof fejktar === 'string' ? parseInt(fejktar, 16) : fejktar
        fejkkat = typeof fejkkat === 'string' ? parseInt(fejkkat, 16) : fejkkat
        fejktreb = typeof fejktreb === 'string' ? parseInt(fejktreb, 16) : fejktreb
        karetatar = typeof karetatar === 'string' ? parseInt(karetatar, 16) : karetatar
        karetakat = typeof karetakat === 'string' ? parseInt(karetakat, 16) : karetakat
        karetatreb = typeof karetatreb === 'string' ? parseInt(karetatreb, 16) : karetatreb


        socketService.emit(routeProvider.SAVE_NEW_PRESET, {
            village_id: villages[0].data.villageId,
            name: 'Farma (pik)',
            icon: pikinier,
            officers: {
                leader: false,
                loot_master: false,
                medic: false,
                scout: false,
                supporter: false,
                bastard: false
            },
            units: {
                spear: 20,
                sword: 0,
                axe: 0,
                archer: 0,
                light_cavalry: 0,
                mounted_archer: 0,
                heavy_cavalry: 0,
                ram: 0,
                catapult: 0,
                trebuchet: 0,
                doppelsoldner: 0,
                snob: 0,
                knight: 0
            }
        })
        socketService.emit(routeProvider.SAVE_NEW_PRESET, {
            village_id: villages[0].data.villageId,
            name: 'Farma (miecz)',
            icon: miecznik,
            officers: {
                leader: false,
                loot_master: false,
                medic: false,
                scout: false,
                supporter: false,
                bastard: false
            },
            units: {
                spear: 0,
                sword: 33,
                axe: 0,
                archer: 0,
                light_cavalry: 0,
                mounted_archer: 0,
                heavy_cavalry: 0,
                ram: 0,
                catapult: 0,
                trebuchet: 0,
                doppelsoldner: 0,
                snob: 0,
                knight: 0
            }
        })
        socketService.emit(routeProvider.SAVE_NEW_PRESET, {
            village_id: villages[0].data.villageId,
            name: 'Farma (top)',
            icon: topornik,
            officers: {
                leader: false,
                loot_master: false,
                medic: false,
                scout: false,
                supporter: false,
                bastard: false
            },
            units: {
                spear: 0,
                sword: 0,
                axe: 25,
                archer: 0,
                light_cavalry: 0,
                mounted_archer: 0,
                heavy_cavalry: 0,
                ram: 0,
                catapult: 0,
                trebuchet: 0,
                doppelsoldner: 0,
                snob: 0,
                knight: 0
            }
        })
        socketService.emit(routeProvider.SAVE_NEW_PRESET, {
            village_id: villages[0].data.villageId,
            name: 'Farma (łuk)',
            icon: łucznik,
            officers: {
                leader: false,
                loot_master: false,
                medic: false,
                scout: false,
                supporter: false,
                bastard: false
            },
            units: {
                spear: 0,
                sword: 0,
                axe: 0,
                archer: 50,
                light_cavalry: 0,
                mounted_archer: 0,
                heavy_cavalry: 0,
                ram: 0,
                catapult: 0,
                trebuchet: 0,
                doppelsoldner: 0,
                snob: 0,
                knight: 0
            }
        })
        socketService.emit(routeProvider.SAVE_NEW_PRESET, {
            village_id: villages[0].data.villageId,
            name: 'Farma (lk)',
            icon: lk,
            officers: {
                leader: false,
                loot_master: false,
                medic: false,
                scout: false,
                supporter: false,
                bastard: false
            },
            units: {
                spear: 0,
                sword: 0,
                axe: 0,
                archer: 0,
                light_cavalry: 10,
                mounted_archer: 0,
                heavy_cavalry: 0,
                ram: 0,
                catapult: 0,
                trebuchet: 0,
                doppelsoldner: 0,
                snob: 0,
                knight: 0
            }
        })
        socketService.emit(routeProvider.SAVE_NEW_PRESET, {
            village_id: villages[0].data.villageId,
            name: 'Farma (łk)',
            icon: łk,
            officers: {
                leader: false,
                loot_master: false,
                medic: false,
                scout: false,
                supporter: false,
                bastard: false
            },
            units: {
                spear: 0,
                sword: 0,
                axe: 0,
                archer: 0,
                light_cavalry: 0,
                mounted_archer: 10,
                heavy_cavalry: 0,
                ram: 0,
                catapult: 0,
                trebuchet: 0,
                doppelsoldner: 0,
                snob: 0,
                knight: 0
            }
        })
        socketService.emit(routeProvider.SAVE_NEW_PRESET, {
            village_id: villages[0].data.villageId,
            name: 'Farma (ck)',
            icon: ck,
            officers: {
                leader: false,
                loot_master: false,
                medic: false,
                scout: false,
                supporter: false,
                bastard: false
            },
            units: {
                spear: 0,
                sword: 0,
                axe: 0,
                archer: 0,
                light_cavalry: 0,
                mounted_archer: 0,
                heavy_cavalry: 10,
                ram: 0,
                catapult: 0,
                trebuchet: 0,
                doppelsoldner: 0,
                snob: 0,
                knight: 0
            }
        })
        socketService.emit(routeProvider.SAVE_NEW_PRESET, {
            village_id: villages[0].data.villageId,
            name: 'PartDeff',
            icon: partDeff,
            officers: {
                leader: false,
                loot_master: false,
                medic: false,
                scout: false,
                supporter: false,
                bastard: false
            },
            units: {
                spear: 180,
                sword: 140,
                axe: 0,
                archer: 100,
                light_cavalry: 0,
                mounted_archer: 0,
                heavy_cavalry: 0,
                ram: 0,
                catapult: 0,
                trebuchet: 0,
                doppelsoldner: 0,
                snob: 0,
                knight: 0
            }
        })
        socketService.emit(routeProvider.SAVE_NEW_PRESET, {
            village_id: villages[0].data.villageId,
            name: 'FullDeff',
            icon: fullDeff,
            officers: {
                leader: false,
                loot_master: false,
                medic: false,
                scout: false,
                supporter: false,
                bastard: false
            },
            units: {
                spear: 9000,
                sword: 7000,
                axe: 0,
                archer: 5000,
                light_cavalry: 0,
                mounted_archer: 0,
                heavy_cavalry: 0,
                ram: 0,
                catapult: 0,
                trebuchet: 0,
                doppelsoldner: 0,
                snob: 0,
                knight: 0
            }
        })
        socketService.emit(routeProvider.SAVE_NEW_PRESET, {
            village_id: villages[0].data.villageId,
            name: 'PartOff',
            icon: partOff,
            officers: {
                leader: false,
                loot_master: false,
                medic: false,
                scout: false,
                supporter: false,
                bastard: false
            },
            units: {
                spear: 0,
                sword: 0,
                axe: 200,
                archer: 0,
                light_cavalry: 75,
                mounted_archer: 87,
                heavy_cavalry: 0,
                ram: 15,
                catapult: 0,
                trebuchet: 0,
                doppelsoldner: 0,
                snob: 0,
                knight: 0
            }
        })
        socketService.emit(routeProvider.SAVE_NEW_PRESET, {
            village_id: villages[0].data.villageId,
            name: 'FullOff',
            icon: fullOff,
            officers: {
                leader: false,
                loot_master: false,
                medic: false,
                scout: false,
                supporter: false,
                bastard: false
            },
            units: {
                spear: 0,
                sword: 0,
                axe: 4000,
                archer: 0,
                light_cavalry: 1500,
                mounted_archer: 1750,
                heavy_cavalry: 0,
                ram: 300,
                catapult: 0,
                trebuchet: 0,
                doppelsoldner: 0,
                snob: 0,
                knight: 0
            }
        })
        socketService.emit(routeProvider.SAVE_NEW_PRESET, {
            village_id: villages[0].data.villageId,
            name: 'fejk (pik)',
            icon: fejkpik,
            officers: {
                leader: false,
                loot_master: false,
                medic: false,
                scout: false,
                supporter: false,
                bastard: false
            },
            units: {
                spear: 1,
                sword: 0,
                axe: 0,
                archer: 0,
                light_cavalry: 0,
                mounted_archer: 0,
                heavy_cavalry: 0,
                ram: 0,
                catapult: 0,
                trebuchet: 0,
                doppelsoldner: 0,
                snob: 0,
                knight: 0
            }
        })
        socketService.emit(routeProvider.SAVE_NEW_PRESET, {
            village_id: villages[0].data.villageId,
            name: 'fejk (miecz)',
            icon: fejkmiecz,
            officers: {
                leader: false,
                loot_master: false,
                medic: false,
                scout: false,
                supporter: false,
                bastard: false
            },
            units: {
                spear: 0,
                sword: 1,
                axe: 0,
                archer: 0,
                light_cavalry: 0,
                mounted_archer: 0,
                heavy_cavalry: 0,
                ram: 0,
                catapult: 0,
                trebuchet: 0,
                doppelsoldner: 0,
                snob: 0,
                knight: 0
            }
        })
        socketService.emit(routeProvider.SAVE_NEW_PRESET, {
            village_id: villages[0].data.villageId,
            name: 'fejk (top)',
            icon: fejktop,
            officers: {
                leader: false,
                loot_master: false,
                medic: false,
                scout: false,
                supporter: false,
                bastard: false
            },
            units: {
                spear: 0,
                sword: 0,
                axe: 1,
                archer: 0,
                light_cavalry: 0,
                mounted_archer: 0,
                heavy_cavalry: 0,
                ram: 0,
                catapult: 0,
                trebuchet: 0,
                doppelsoldner: 0,
                snob: 0,
                knight: 0
            }
        })
        socketService.emit(routeProvider.SAVE_NEW_PRESET, {
            village_id: villages[0].data.villageId,
            name: 'fejk (łuk)',
            icon: fejkłuk,
            officers: {
                leader: false,
                loot_master: false,
                medic: false,
                scout: false,
                supporter: false,
                bastard: false
            },
            units: {
                spear: 0,
                sword: 0,
                axe: 0,
                archer: 1,
                light_cavalry: 0,
                mounted_archer: 0,
                heavy_cavalry: 0,
                ram: 0,
                catapult: 0,
                trebuchet: 0,
                doppelsoldner: 0,
                snob: 0,
                knight: 0
            }
        })
        socketService.emit(routeProvider.SAVE_NEW_PRESET, {
            village_id: villages[0].data.villageId,
            name: 'fejk (lk)',
            icon: fejklk,
            officers: {
                leader: false,
                loot_master: false,
                medic: false,
                scout: false,
                supporter: false,
                bastard: false
            },
            units: {
                spear: 0,
                sword: 0,
                axe: 0,
                archer: 0,
                light_cavalry: 1,
                mounted_archer: 0,
                heavy_cavalry: 0,
                ram: 0,
                catapult: 0,
                trebuchet: 0,
                doppelsoldner: 0,
                snob: 0,
                knight: 0
            }
        })
        socketService.emit(routeProvider.SAVE_NEW_PRESET, {
            village_id: villages[0].data.villageId,
            name: 'fejk (łk)',
            icon: fejkłk,
            officers: {
                leader: false,
                loot_master: false,
                medic: false,
                scout: false,
                supporter: false,
                bastard: false
            },
            units: {
                spear: 0,
                sword: 0,
                axe: 0,
                archer: 0,
                light_cavalry: 0,
                mounted_archer: 1,
                heavy_cavalry: 0,
                ram: 0,
                catapult: 0,
                trebuchet: 0,
                doppelsoldner: 0,
                snob: 0,
                knight: 0
            }
        })
        socketService.emit(routeProvider.SAVE_NEW_PRESET, {
            village_id: villages[0].data.villageId,
            name: 'fejk (ck)',
            icon: fejkck,
            officers: {
                leader: false,
                loot_master: false,
                medic: false,
                scout: false,
                supporter: false,
                bastard: false
            },
            units: {
                spear: 0,
                sword: 0,
                axe: 0,
                archer: 0,
                light_cavalry: 0,
                mounted_archer: 0,
                heavy_cavalry: 1,
                ram: 0,
                catapult: 0,
                trebuchet: 0,
                doppelsoldner: 0,
                snob: 0,
                knight: 0
            }
        })
        socketService.emit(routeProvider.SAVE_NEW_PRESET, {
            village_id: villages[0].data.villageId,
            name: 'fejk (tar)',
            icon: fejktar,
            officers: {
                leader: false,
                loot_master: false,
                medic: false,
                scout: false,
                supporter: false,
                bastard: false
            },
            units: {
                spear: 0,
                sword: 0,
                axe: 0,
                archer: 0,
                light_cavalry: 0,
                mounted_archer: 0,
                heavy_cavalry: 0,
                ram: 1,
                catapult: 0,
                trebuchet: 0,
                doppelsoldner: 0,
                snob: 0,
                knight: 0
            }
        })
        socketService.emit(routeProvider.SAVE_NEW_PRESET, {
            village_id: villages[0].data.villageId,
            name: 'fejk (kat)',
            icon: fejkkat,
            officers: {
                leader: false,
                loot_master: false,
                medic: false,
                scout: false,
                supporter: false,
                bastard: false
            },
            units: {
                spear: 0,
                sword: 0,
                axe: 0,
                archer: 0,
                light_cavalry: 0,
                mounted_archer: 0,
                heavy_cavalry: 0,
                ram: 0,
                catapult: 1,
                trebuchet: 0,
                doppelsoldner: 0,
                snob: 0,
                knight: 0
            }
        })
        socketService.emit(routeProvider.SAVE_NEW_PRESET, {
            village_id: villages[0].data.villageId,
            name: 'fejk (treb)',
            icon: fejktreb,
            officers: {
                leader: false,
                loot_master: false,
                medic: false,
                scout: false,
                supporter: false,
                bastard: false
            },
            units: {
                spear: 0,
                sword: 0,
                axe: 0,
                archer: 0,
                light_cavalry: 0,
                mounted_archer: 0,
                heavy_cavalry: 0,
                ram: 0,
                catapult: 0,
                trebuchet: 1,
                doppelsoldner: 0,
                snob: 0,
                knight: 0
            }
        })	
        socketService.emit(routeProvider.SAVE_NEW_PRESET, {
            village_id: villages[0].data.villageId,
            name: 'kareta (tar)',
            icon: karetatreb,
            officers: {
                leader: false,
                loot_master: false,
                medic: false,
                scout: false,
                supporter: false,
                bastard: false
            },
            units: {
                spear: 0,
                sword: 0,
                axe: 0,
                archer: 0,
                light_cavalry: 0,
                mounted_archer: 0,
                heavy_cavalry: 0,
                ram: 1,
                catapult: 0,
                trebuchet: 0,
                doppelsoldner: 0,
                snob: 0,
                knight: 0
            }
        })	
        socketService.emit(routeProvider.SAVE_NEW_PRESET, {
            village_id: villages[0].data.villageId,
            name: 'kareta (kat)',
            icon: karetatreb,
            officers: {
                leader: false,
                loot_master: false,
                medic: false,
                scout: false,
                supporter: false,
                bastard: false
            },
            units: {
                spear: 0,
                sword: 0,
                axe: 0,
                archer: 0,
                light_cavalry: 0,
                mounted_archer: 0,
                heavy_cavalry: 0,
                ram: 0,
                catapult: 1,
                trebuchet: 0,
                doppelsoldner: 0,
                snob: 0,
                knight: 0
            }
        })	
        socketService.emit(routeProvider.SAVE_NEW_PRESET, {
            village_id: villages[0].data.villageId,
            name: 'kareta (treb)',
            icon: karetatreb,
            officers: {
                leader: false,
                loot_master: false,
                medic: false,
                scout: false,
                supporter: false,
                bastard: false
            },
            units: {
                spear: 0,
                sword: 0,
                axe: 0,
                archer: 0,
                light_cavalry: 0,
                mounted_archer: 0,
                heavy_cavalry: 0,
                ram: 0,
                catapult: 0,
                trebuchet: 1,
                doppelsoldner: 0,
                snob: 0,
                knight: 0
            }
        })		
        utils.notif('success', $filter('i18n')('done', $rootScope.loc.ale, 'preset_creator'))
        utils.notif('success', $filter('i18n')('deactivated', $rootScope.loc.ale, 'preset_creator'))
        presetCreator.stop()
    }
    var presetCreator = {}
    presetCreator.init = function() {
        initialized = true
    }
    presetCreator.start = function() {
        eventQueue.trigger(eventTypeProvider.PRESET_CREATOR_STARTED)
        running = true
        createPresets()
    }
    presetCreator.stop = function() {
        eventQueue.trigger(eventTypeProvider.PRESET_CREATOR_STOPPED)
        running = false
    }
    presetCreator.isRunning = function() {
        return running
    }
    presetCreator.isInitialized = function() {
        return initialized
    }
    return presetCreator
})
define('two/presetCreator/events', [], function () {
    angular.extend(eventTypeProvider, {
        PRESET_CREATOR_STARTED: 'preset_creator_started',
        PRESET_CREATOR_STOPPED: 'preset_creator_stopped'
    })
})

define('two/presetCreator/ui', [
    'two/ui',
    'two/presetCreator',
    'two/utils',
    'queues/EventQueue'
], function (
    interfaceOverflow,
    presetCreator,
    utils,
    eventQueue
) {
    let $button

    const init = function () {
        interfaceOverflow.addDivisor(101)
        $button = interfaceOverflow.addMenuButton('Wojewoda', 100, $filter('i18n')('description', $rootScope.loc.ale, 'preset_creator'))

        $button.addEventListener('click', function () {
            if (presetCreator.isRunning()) {
                presetCreator.stop()
                utils.notif('success', $filter('i18n')('deactivated', $rootScope.loc.ale, 'preset_creator'))
            } else {
                presetCreator.start()
                utils.notif('success', $filter('i18n')('activated', $rootScope.loc.ale, 'preset_creator'))
            }
        })

        eventQueue.register(eventTypeProvider.PRESET_CREATOR_STARTED, function () {
            $button.classList.remove('btn-orange')
            $button.classList.add('btn-red')
        })

        eventQueue.register(eventTypeProvider.PRESET_CREATOR_STOPPED, function () {
            $button.classList.remove('btn-red')
            $button.classList.add('btn-orange')
        })

        if (presetCreator.isRunning()) {
            eventQueue.trigger(eventTypeProvider.PRESET_CREATOR_STARTED)
        }

        return opener
    }

    return init
})


require([
    'two/ready',
    'two/presetCreator',
    'two/presetCreator/ui',
    'Lockr',
    'queues/EventQueue',
    'two/presetCreator/events',
], function(
    ready,
    presetCreator,
    presetCreatorInterface,
    Lockr,
    eventQueue
) {
    const STORAGE_KEYS = {
        ACTIVE: 'preset_creator_active'
    }
	
    if (presetCreator.isInitialized()) {
        return false
    }
    ready(function() {
        presetCreator.init()
        presetCreatorInterface()

        ready(function() {
            if (Lockr.get(STORAGE_KEYS.ACTIVE, false, true)) {
                presetCreator.start()
            }
			
            eventQueue.register(eventTypeProvider.PRESET_CREATOR_STARTED, function() {
                Lockr.set(STORAGE_KEYS.ACTIVE, true)
            })

            eventQueue.register(eventTypeProvider.PRESET_CREATOR_STOPPED, function() {
                Lockr.set(STORAGE_KEYS.ACTIVE, false)
            })
        }, ['initial_village'])
    })
})
define('two/recruitQueue', [
    'two/Settings',
    'two/recruitQueue/settings',
    'two/recruitQueue/settings/map',
    'two/recruitQueue/settings/updates',
    'two/recruitQueue/types/units',
    'two/ready',
    'queues/EventQueue'
], function(
    Settings,
    SETTINGS,
    SETTINGS_MAP,
    UPDATES,
    RQ_UNIT,
    ready,
    eventQueue
) {
    let initialized = false
    let running = false
    let settings
    let recruitQueueSettings
    let selectedPreset1 = []
    let selectedPreset2 = []
    let selectedPreset3 = []
    let selectedPreset4 = []
    let selectedPreset1_F = []
    let selectedPreset2_F = []
    let selectedPreset3_F = []
    let selectedPreset4_F = []
    let selectedGroups1 = []
    let selectedGroups2 = []
    let selectedGroups3 = []
    let selectedGroups4 = []
    let selectedGroups5 = []
    let selectedGroups6 = []
    let selectedGroups7 = []
    let selectedGroups8 = []
    let selectedGroups9 = []
    let selectedGroups10 = []
    let selectedGroups11 = []
    let selectedGroups12 = []
    let selectedGroups13 = []
    let selectedGroups14 = []
    let selectedGroups15 = []
    let selectedGroups16 = []
    let selectedGroups17 = []
    let selectedGroups18 = []
    let selectedGroups19 = []
    let selectedGroups20 = []
    let selectedGroups21 = []
    let selectedGroups22 = []
    let selectedGroups23 = []
    let selectedGroups24 = []
    const STORAGE_KEYS = {
        SETTINGS: 'recruit_queue_settings'
    }
    const RECRUIT_UNIT = {
        [RQ_UNIT.SPEAR]: 'spear',
        [RQ_UNIT.SWORD]: 'sword',
        [RQ_UNIT.AXE]: 'axe',
        [RQ_UNIT.ARCHER]: 'archer',
        [RQ_UNIT.LIGHT_CAVALRY]: 'light_cavalry',
        [RQ_UNIT.MOUNTED_ARCHER]: 'mounted_archer',
        [RQ_UNIT.HEAVT_CAVALRY]: 'heavy_cavalry',
        [RQ_UNIT.RAM]: 'ram',
        [RQ_UNIT.CATAPULT]: 'catapult',
        [RQ_UNIT.TREBUCHET]: 'trebuchet',
        [RQ_UNIT.DOPPELSOLDNER]: 'doppelsoldner',
        [RQ_UNIT.SNOB]: 'snob',
        [RQ_UNIT.KNIGHT]: 'knight'
    }
    console.log(RECRUIT_UNIT)
    const updatePresets = function() {
        selectedPreset1 = []
        selectedPreset2 = []
        selectedPreset3 = []
        selectedPreset4 = []
        selectedPreset1_F = []
        selectedPreset2_F = []
        selectedPreset3_F = []
        selectedPreset4_F = []
        const allPresets = modelDataService.getPresetList().getPresets()
        const presetsSelectedByTheUser1 = recruitQueueSettings[SETTINGS.PRESET1]
        const presetsSelectedByTheUser2 = recruitQueueSettings[SETTINGS.PRESET2]
        const presetsSelectedByTheUser3 = recruitQueueSettings[SETTINGS.PRESET3]
        const presetsSelectedByTheUser4 = recruitQueueSettings[SETTINGS.PRESET4]
        const presetsSelectedByTheUser1_F = recruitQueueSettings[SETTINGS.PRESET1_FINAL]
        const presetsSelectedByTheUser2_F = recruitQueueSettings[SETTINGS.PRESET2_FINAL]
        const presetsSelectedByTheUser3_F = recruitQueueSettings[SETTINGS.PRESET3_FINAL]
        const presetsSelectedByTheUser4_F = recruitQueueSettings[SETTINGS.PRESET4_FINAL]
        presetsSelectedByTheUser1.forEach(function(presetId) {
            selectedPreset1.push(allPresets[presetId])
        })
        presetsSelectedByTheUser2.forEach(function(presetId) {
            selectedPreset2.push(allPresets[presetId])
        })
        presetsSelectedByTheUser3.forEach(function(presetId) {
            selectedPreset3.push(allPresets[presetId])
        })
        presetsSelectedByTheUser4.forEach(function(presetId) {
            selectedPreset4.push(allPresets[presetId])
        })
        presetsSelectedByTheUser1_F.forEach(function(presetId) {
            selectedPreset1_F.push(allPresets[presetId])
        })
        presetsSelectedByTheUser2_F.forEach(function(presetId) {
            selectedPreset2_F.push(allPresets[presetId])
        })
        presetsSelectedByTheUser3_F.forEach(function(presetId) {
            selectedPreset3_F.push(allPresets[presetId])
        })
        presetsSelectedByTheUser4_F.forEach(function(presetId) {
            selectedPreset4_F.push(allPresets[presetId])
        })
    }
    const updateGroups = function() {
        selectedGroups1 = []
        selectedGroups2 = []
        selectedGroups3 = []
        selectedGroups4 = []
        selectedGroups5 = []
        selectedGroups6 = []
        selectedGroups7 = []
        selectedGroups8 = []
        selectedGroups9 = []
        selectedGroups10 = []
        selectedGroups11 = []
        selectedGroups12 = []
        selectedGroups13 = []
        selectedGroups14 = []
        selectedGroups15 = []
        selectedGroups16 = []
        selectedGroups17 = []
        selectedGroups18 = []
        selectedGroups19 = []
        selectedGroups20 = []
        selectedGroups21 = []
        selectedGroups22 = []
        selectedGroups23 = []
        selectedGroups24 = []
        const allGroups = modelDataService.getGroupList().getGroups()
        const groupsSelectedByTheUser1 = recruitQueueSettings[SETTINGS.GROUP1]
        const groupsSelectedByTheUser2 = recruitQueueSettings[SETTINGS.GROUP2]
        const groupsSelectedByTheUser3 = recruitQueueSettings[SETTINGS.GROUP3]
        const groupsSelectedByTheUser4 = recruitQueueSettings[SETTINGS.GROUP4]
        const groupsSelectedByTheUser5 = recruitQueueSettings[SETTINGS.GROUP5]
        const groupsSelectedByTheUser6 = recruitQueueSettings[SETTINGS.GROUP6]
        const groupsSelectedByTheUser7 = recruitQueueSettings[SETTINGS.GROUP7]
        const groupsSelectedByTheUser8 = recruitQueueSettings[SETTINGS.GROUP8]
        const groupsSelectedByTheUser9 = recruitQueueSettings[SETTINGS.GROUP9]
        const groupsSelectedByTheUser10 = recruitQueueSettings[SETTINGS.GROUP10]
        const groupsSelectedByTheUser11 = recruitQueueSettings[SETTINGS.GROUP11]
        const groupsSelectedByTheUser12 = recruitQueueSettings[SETTINGS.GROUP12]
        const groupsSelectedByTheUser13 = recruitQueueSettings[SETTINGS.GROUP13]
        const groupsSelectedByTheUser14 = recruitQueueSettings[SETTINGS.GROUP14]
        const groupsSelectedByTheUser15 = recruitQueueSettings[SETTINGS.GROUP15]
        const groupsSelectedByTheUser16 = recruitQueueSettings[SETTINGS.GROUP16]
        const groupsSelectedByTheUser17 = recruitQueueSettings[SETTINGS.GROUP17]
        const groupsSelectedByTheUser18 = recruitQueueSettings[SETTINGS.GROUP18]
        const groupsSelectedByTheUser19 = recruitQueueSettings[SETTINGS.GROUP19]
        const groupsSelectedByTheUser20 = recruitQueueSettings[SETTINGS.GROUP20]
        const groupsSelectedByTheUser21 = recruitQueueSettings[SETTINGS.GROUP21]
        const groupsSelectedByTheUser22 = recruitQueueSettings[SETTINGS.GROUP22]
        const groupsSelectedByTheUser23 = recruitQueueSettings[SETTINGS.GROUP23]
        const groupsSelectedByTheUser24 = recruitQueueSettings[SETTINGS.GROUP24]
        groupsSelectedByTheUser1.forEach(function(groupId) {
            selectedGroups1.push(allGroups[groupId])
        })
        groupsSelectedByTheUser2.forEach(function(groupId) {
            selectedGroups2.push(allGroups[groupId])
        })
        groupsSelectedByTheUser3.forEach(function(groupId) {
            selectedGroups3.push(allGroups[groupId])
        })
        groupsSelectedByTheUser4.forEach(function(groupId) {
            selectedGroups4.push(allGroups[groupId])
        })
        groupsSelectedByTheUser5.forEach(function(groupId) {
            selectedGroups5.push(allGroups[groupId])
        })
        groupsSelectedByTheUser6.forEach(function(groupId) {
            selectedGroups6.push(allGroups[groupId])
        })
        groupsSelectedByTheUser7.forEach(function(groupId) {
            selectedGroups7.push(allGroups[groupId])
        })
        groupsSelectedByTheUser8.forEach(function(groupId) {
            selectedGroups8.push(allGroups[groupId])
        })
        groupsSelectedByTheUser9.forEach(function(groupId) {
            selectedGroups9.push(allGroups[groupId])
        })
        groupsSelectedByTheUser10.forEach(function(groupId) {
            selectedGroups10.push(allGroups[groupId])
        })
        groupsSelectedByTheUser11.forEach(function(groupId) {
            selectedGroups11.push(allGroups[groupId])
        })
        groupsSelectedByTheUser12.forEach(function(groupId) {
            selectedGroups12.push(allGroups[groupId])
        })
        groupsSelectedByTheUser13.forEach(function(groupId) {
            selectedGroups13.push(allGroups[groupId])
        })
        groupsSelectedByTheUser14.forEach(function(groupId) {
            selectedGroups14.push(allGroups[groupId])
        })
        groupsSelectedByTheUser15.forEach(function(groupId) {
            selectedGroups15.push(allGroups[groupId])
        })
        groupsSelectedByTheUser16.forEach(function(groupId) {
            selectedGroups16.push(allGroups[groupId])
        })
        groupsSelectedByTheUser17.forEach(function(groupId) {
            selectedGroups17.push(allGroups[groupId])
        })
        groupsSelectedByTheUser18.forEach(function(groupId) {
            selectedGroups18.push(allGroups[groupId])
        })
        groupsSelectedByTheUser19.forEach(function(groupId) {
            selectedGroups19.push(allGroups[groupId])
        })
        groupsSelectedByTheUser20.forEach(function(groupId) {
            selectedGroups20.push(allGroups[groupId])
        })
        groupsSelectedByTheUser21.forEach(function(groupId) {
            selectedGroups21.push(allGroups[groupId])
        })
        groupsSelectedByTheUser22.forEach(function(groupId) {
            selectedGroups22.push(allGroups[groupId])
        })
        groupsSelectedByTheUser23.forEach(function(groupId) {
            selectedGroups23.push(allGroups[groupId])
        })
        groupsSelectedByTheUser24.forEach(function(groupId) {
            selectedGroups24.push(allGroups[groupId])
        })
    }
    const recruitQueue = {}
    recruitQueue.init = function() {
        initialized = true
        settings = new Settings({
            settingsMap: SETTINGS_MAP,
            storageKey: STORAGE_KEYS.SETTINGS
        })
        settings.onChange(function(changes, updates) {
            recruitQueueSettings = settings.getAll()
            if (updates[UPDATES.PRESETS]) {
                updatePresets()
            }
            if (updates[UPDATES.GROUPS]) {
                updateGroups()
            }
        })
        recruitQueueSettings = settings.getAll()
        console.log('all settings', recruitQueueSettings)
        ready(function() {
            updatePresets()
        }, 'presets')
        $rootScope.$on(eventTypeProvider.ARMY_PRESET_UPDATE, updatePresets)
        $rootScope.$on(eventTypeProvider.ARMY_PRESET_DELETED, updatePresets)
        $rootScope.$on(eventTypeProvider.GROUPS_CREATED, updateGroups)
        $rootScope.$on(eventTypeProvider.GROUPS_DESTROYED, updateGroups)
        $rootScope.$on(eventTypeProvider.GROUPS_UPDATED, updateGroups)
    }
    recruitQueue.start = function() {
        running = true
        eventQueue.trigger(eventTypeProvider.recruit_queue_START)
    }
    recruitQueue.stop = function() {
        running = false
        eventQueue.trigger(eventTypeProvider.recruit_queue_STOP)
    }
    recruitQueue.getSettings = function() {
        return settings
    }
    recruitQueue.isInitialized = function() {
        return initialized
    }
    recruitQueue.isRunning = function() {
        return running
    }
    return recruitQueue
})
define('two/recruitQueue/events', [], function () {
    angular.extend(eventTypeProvider, {
        RECRUIT_QUEUE_START: 'recruit_queue_start',
        RECRUIT_QUEUE_STOP: 'recruit_queue_stop'
    })
})

define('two/recruitQueue/ui', [
    'two/ui',
    'two/recruitQueue',
    'two/recruitQueue/settings',
    'two/recruitQueue/settings/map',
    'two/recruitQueue/types/units',
    'two/Settings',
    'two/EventScope',
    'two/utils'
], function (
    interfaceOverflow,
    recruitQueue,
    SETTINGS,
    SETTINGS_MAP,
    RQ_UNIT,
    Settings,
    EventScope,
    utils
) {
    let $scope
    let settings
    let presetList = modelDataService.getPresetList()
    let groupList = modelDataService.getGroupList()
    let $button
    
    const TAB_TYPES = {
        PRESETS: 'presets',
        OWN: 'own',
        LOGS: 'logs'
    }

    const selectTab = function (tabType) {
        $scope.selectedTab = tabType
    }

    const saveSettings = function () {
        settings.setAll(settings.decode($scope.settings))

        utils.notif('success', 'Settings saved')
    }

    const switchState = function () {
        if (recruitQueue.isRunning()) {
            recruitQueue.stop()
        } else {
            recruitQueue.start()
        }
    }

    const eventHandlers = {
        updatePresets: function () {
            $scope.presets = Settings.encodeList(presetList.getPresets(), {
                disabled: false,
                type: 'presets'
            })
        },
        updateGroups: function () {
            $scope.groups = Settings.encodeList(groupList.getGroups(), {
                disabled: false,
                type: 'groups'
            })
        },
        start: function () {
            $scope.running = true

            $button.classList.remove('btn-orange')
            $button.classList.add('btn-red')

            utils.notif('success', $filter('i18n')('general.stopped', $rootScope.loc.ale, 'recruit_queue'))
        },
        stop: function () {
            $scope.running = false

            $button.classList.remove('btn-red')
            $button.classList.add('btn-orange')

            utils.notif('success', $filter('i18n')('general.stopped', $rootScope.loc.ale, 'recruit_queue'))
        }
    }

    const init = function () {
        settings = recruitQueue.getSettings()
        interfaceOverflow.addDivisor(81)
        $button = interfaceOverflow.addMenuButton('Kapitan', 80)
        $button.addEventListener('click', buildWindow)

        interfaceOverflow.addTemplate('twoverflow_recruit_queue_window', `<div id=\"two-recruit-queue\" class=\"win-content two-window\"><header class=\"win-head\"><h2>Kapitan</h2><ul class=\"list-btn\"><li><a href=\"#\" class=\"size-34x34 btn-red icon-26x26-close\" ng-click=\"closeWindow()\"></a></ul></header><div class=\"win-main\" scrollbar=\"\"><div class=\"tabs tabs-bg\"><div class=\"tabs-three-col\"><div class=\"tab\" ng-click=\"selectTab(TAB_TYPES.PRESETS)\" ng-class=\"{'tab-active': selectedTab == TAB_TYPES.PRESETS}\"><div class=\"tab-inner\"><div ng-class=\"{'box-border-light': selectedTab === TAB_TYPES.PRESETS}\"><a href=\"#\" ng-class=\"{'btn-icon btn-orange': selectedTab !== TAB_TYPES.PRESETS}\">{{ TAB_TYPES.PRESETS | i18n:loc.ale:'recruit_queue' }}</a></div></div></div><div class=\"tab\" ng-click=\"selectTab(TAB_TYPES.OWN)\" ng-class=\"{'tab-active': selectedTab == TAB_TYPES.OWN}\"><div class=\"tab-inner\"><div ng-class=\"{'box-border-light': selectedTab === TAB_TYPES.OWN}\"><a href=\"#\" ng-class=\"{'btn-icon btn-orange': selectedTab !== TAB_TYPES.OWN}\">{{ TAB_TYPES.OWN | i18n:loc.ale:'recruit_queue' }}</a></div></div></div><div class=\"tab\" ng-click=\"selectTab(TAB_TYPES.LOGS)\" ng-class=\"{'tab-active': selectedTab == TAB_TYPES.LOGS}\"><div class=\"tab-inner\"><div ng-class=\"{'box-border-light': selectedTab === TAB_TYPES.LOGS}\"><a href=\"#\" ng-class=\"{'btn-icon btn-orange': selectedTab !== TAB_TYPES.LOGS}\">{{ TAB_TYPES.LOGS | i18n:loc.ale:'recruit_queue' }}</a></div></div></div></div></div><div class=\"box-paper footer\"><div class=\"scroll-wrap\"><div class=\"settings\" ng-show=\"selectedTab === TAB_TYPES.PRESETS\"><h5 class=\"twx-section\">{{ 'recruit.presets' | i18n:loc.ale:'recruit_queue' }}</h5><form class=\"addForm\"><table class=\"tbl-border-light tbl-striped\"><col width=\"32%\"><col><col><thead><tr><th>{{ 'group' | i18n:loc.ale:'recruit_queue' }}<th>{{ 'preset' | i18n:loc.ale:'recruit_queue' }}<th>{{ 'presetfinal' | i18n:loc.ale:'recruit_queue' }}<tbody><tr><td><div select=\"\" list=\"groups\" selected=\"settings[SETTINGS.GROUP1]\" drop-down=\"true\"></div><td><div select=\"\" list=\"presets\" selected=\"settings[SETTINGS.PRESET1]\" drop-down=\"true\"></div><td><div select=\"\" list=\"presets\" selected=\"settings[SETTINGS.PRESET1_FINAL]\" drop-down=\"true\"></div><tr><td><div select=\"\" list=\"groups\" selected=\"settings[SETTINGS.GROUP2]\" drop-down=\"true\"></div><td><div select=\"\" list=\"presets\" selected=\"settings[SETTINGS.PRESET2]\" drop-down=\"true\"></div><td><div select=\"\" list=\"presets\" selected=\"settings[SETTINGS.PRESET2_FINAL]\" drop-down=\"true\"></div><tr><td><div select=\"\" list=\"groups\" selected=\"settings[SETTINGS.GROUP3]\" drop-down=\"true\"></div><td><div select=\"\" list=\"presets\" selected=\"settings[SETTINGS.PRESET3]\" drop-down=\"true\"></div><td><div select=\"\" list=\"presets\" selected=\"settings[SETTINGS.PRESET3_FINAL]\" drop-down=\"true\"></div><tr><td><div select=\"\" list=\"groups\" selected=\"settings[SETTINGS.GROUP4]\" drop-down=\"true\"></div><td><div select=\"\" list=\"presets\" selected=\"settings[SETTINGS.PRESET4]\" drop-down=\"true\"></div><td><div select=\"\" list=\"presets\" selected=\"settings[SETTINGS.PRESET4_FINAL]\" drop-down=\"true\"></div></table></form></div><div class=\"rich-text\" ng-show=\"selectedTab === TAB_TYPES.OWN\"><h5 class=\"twx-section\">{{ 'recruit.own' | i18n:loc.ale:'recruit_queue' }}</h5><form class=\"addForm\"><table class=\"tbl-border-light tbl-striped\"><col><col><col width=\"200px\"><col width=\"60px\"><thead><tr><th>{{ 'group' | i18n:loc.ale:'recruit_queue' }}<th>{{ 'unit' | i18n:loc.ale:'recruit_queue' }}<th colspan=\"2\">{{ 'amount' | i18n:loc.ale:'recruit_queue' }}<tbody><tr><td><div select=\"\" list=\"groups\" selected=\"settings[SETTINGS.GROUP5]\" drop-down=\"true\"></div><td><div select=\"\" list=\"units\" selected=\"settings[SETTINGS.UNIT1]\" drop-down=\"true\"></div><td><div range-slider=\"\" min=\"settingsMap[SETTINGS.AMOUNT1].min\" max=\"settingsMap[SETTINGS.AMOUNT1].max\" value=\"settings[SETTINGS.AMOUNT1]\" enabled=\"true\"></div><td class=\"cell-bottom\"><input class=\"fit textfield-border text-center\" ng-model=\"settings[SETTINGS.AMOUNT1]\"><tr><td><div select=\"\" list=\"groups\" selected=\"settings[SETTINGS.GROUP6]\" drop-down=\"true\"></div><td><div select=\"\" list=\"units\" selected=\"settings[SETTINGS.UNIT2]\" drop-down=\"true\"></div><td><div range-slider=\"\" min=\"settingsMap[SETTINGS.AMOUNT2].min\" max=\"settingsMap[SETTINGS.AMOUNT2].max\" value=\"settings[SETTINGS.AMOUNT2]\" enabled=\"true\"></div><td class=\"cell-bottom\"><input class=\"fit textfield-border text-center\" ng-model=\"settings[SETTINGS.AMOUNT2]\"><tr><td><div select=\"\" list=\"groups\" selected=\"settings[SETTINGS.GROUP7]\" drop-down=\"true\"></div><td><div select=\"\" list=\"units\" selected=\"settings[SETTINGS.UNIT3]\" drop-down=\"true\"></div><td><div range-slider=\"\" min=\"settingsMap[SETTINGS.AMOUNT3].min\" max=\"settingsMap[SETTINGS.AMOUNT3].max\" value=\"settings[SETTINGS.AMOUNT3]\" enabled=\"true\"></div><td class=\"cell-bottom\"><input class=\"fit textfield-border text-center\" ng-model=\"settings[SETTINGS.AMOUNT3]\"><tr><td><div select=\"\" list=\"groups\" selected=\"settings[SETTINGS.GROUP8]\" drop-down=\"true\"></div><td><div select=\"\" list=\"units\" selected=\"settings[SETTINGS.UNIT4]\" drop-down=\"true\"></div><td><div range-slider=\"\" min=\"settingsMap[SETTINGS.AMOUNT4].min\" max=\"settingsMap[SETTINGS.AMOUNT4].max\" value=\"settings[SETTINGS.AMOUNT4]\" enabled=\"true\"></div><td class=\"cell-bottom\"><input class=\"fit textfield-border text-center\" ng-model=\"settings[SETTINGS.AMOUNT4]\"><tr><td><div select=\"\" list=\"groups\" selected=\"settings[SETTINGS.GROUP9]\" drop-down=\"true\"></div><td><div select=\"\" list=\"units\" selected=\"settings[SETTINGS.UNIT5]\" drop-down=\"true\"></div><td><div range-slider=\"\" min=\"settingsMap[SETTINGS.AMOUNT5].min\" max=\"settingsMap[SETTINGS.AMOUNT5].max\" value=\"settings[SETTINGS.AMOUNT5]\" enabled=\"true\"></div><td class=\"cell-bottom\"><input class=\"fit textfield-border text-center\" ng-model=\"settings[SETTINGS.AMOUNT5]\"><tr><td><div select=\"\" list=\"groups\" selected=\"settings[SETTINGS.GROUP10]\" drop-down=\"true\"></div><td><div select=\"\" list=\"units\" selected=\"settings[SETTINGS.UNIT6]\" drop-down=\"true\"></div><td><div range-slider=\"\" min=\"settingsMap[SETTINGS.AMOUNT6].min\" max=\"settingsMap[SETTINGS.AMOUNT6].max\" value=\"settings[SETTINGS.AMOUNT6]\" enabled=\"true\"></div><td class=\"cell-bottom\"><input class=\"fit textfield-border text-center\" ng-model=\"settings[SETTINGS.AMOUNT6]\"><tr><td><div select=\"\" list=\"groups\" selected=\"settings[SETTINGS.GROUP11]\" drop-down=\"true\"></div><td><div select=\"\" list=\"units\" selected=\"settings[SETTINGS.UNIT7]\" drop-down=\"true\"></div><td><div range-slider=\"\" min=\"settingsMap[SETTINGS.AMOUNT7].min\" max=\"settingsMap[SETTINGS.AMOUNT7].max\" value=\"settings[SETTINGS.AMOUNT7]\" enabled=\"true\"></div><td class=\"cell-bottom\"><input class=\"fit textfield-border text-center\" ng-model=\"settings[SETTINGS.AMOUNT7]\"><tr><td><div select=\"\" list=\"groups\" selected=\"settings[SETTINGS.GROUP12]\" drop-down=\"true\"></div><td><div select=\"\" list=\"units\" selected=\"settings[SETTINGS.UNIT8]\" drop-down=\"true\"></div><td><div range-slider=\"\" min=\"settingsMap[SETTINGS.AMOUNT8].min\" max=\"settingsMap[SETTINGS.AMOUNT8].max\" value=\"settings[SETTINGS.AMOUNT8]\" enabled=\"true\"></div><td class=\"cell-bottom\"><input class=\"fit textfield-border text-center\" ng-model=\"settings[SETTINGS.AMOUNT8]\"><tr><td><div select=\"\" list=\"groups\" selected=\"settings[SETTINGS.GROUP13]\" drop-down=\"true\"></div><td><div select=\"\" list=\"units\" selected=\"settings[SETTINGS.UNIT9]\" drop-down=\"true\"></div><td><div range-slider=\"\" min=\"settingsMap[SETTINGS.AMOUNT9].min\" max=\"settingsMap[SETTINGS.AMOUNT9].max\" value=\"settings[SETTINGS.AMOUNT9]\" enabled=\"true\"></div><td class=\"cell-bottom\"><input class=\"fit textfield-border text-center\" ng-model=\"settings[SETTINGS.AMOUNT9]\"><tr><td><div select=\"\" list=\"groups\" selected=\"settings[SETTINGS.GROUP14]\" drop-down=\"true\"></div><td><div select=\"\" list=\"units\" selected=\"settings[SETTINGS.UNIT10]\" drop-down=\"true\"></div><td><div range-slider=\"\" min=\"settingsMap[SETTINGS.AMOUNT10].min\" max=\"settingsMap[SETTINGS.AMOUNT10].max\" value=\"settings[SETTINGS.AMOUNT10]\" enabled=\"true\"></div><td class=\"cell-bottom\"><input class=\"fit textfield-border text-center\" ng-model=\"settings[SETTINGS.AMOUNT10]\"><tr><td><div select=\"\" list=\"groups\" selected=\"settings[SETTINGS.GROUP15]\" drop-down=\"true\"></div><td><div select=\"\" list=\"units\" selected=\"settings[SETTINGS.UNIT11]\" drop-down=\"true\"></div><td><div range-slider=\"\" min=\"settingsMap[SETTINGS.AMOUNT11].min\" max=\"settingsMap[SETTINGS.AMOUNT11].max\" value=\"settings[SETTINGS.AMOUNT11]\" enabled=\"true\"></div><td class=\"cell-bottom\"><input class=\"fit textfield-border text-center\" ng-model=\"settings[SETTINGS.AMOUNT11]\"><tr><td><div select=\"\" list=\"groups\" selected=\"settings[SETTINGS.GROUP16]\" drop-down=\"true\"></div><td><div select=\"\" list=\"units\" selected=\"settings[SETTINGS.UNIT12]\" drop-down=\"true\"></div><td><div range-slider=\"\" min=\"settingsMap[SETTINGS.AMOUNT12].min\" max=\"settingsMap[SETTINGS.AMOUNT12].max\" value=\"settings[SETTINGS.AMOUNT12]\" enabled=\"true\"></div><td class=\"cell-bottom\"><input class=\"fit textfield-border text-center\" ng-model=\"settings[SETTINGS.AMOUNT12]\"><tr><td><div select=\"\" list=\"groups\" selected=\"settings[SETTINGS.GROUP17]\" drop-down=\"true\"></div><td><div select=\"\" list=\"units\" selected=\"settings[SETTINGS.UNIT13]\" drop-down=\"true\"></div><td><div range-slider=\"\" min=\"settingsMap[SETTINGS.AMOUNT13].min\" max=\"settingsMap[SETTINGS.AMOUNT13].max\" value=\"settings[SETTINGS.AMOUNT13]\" enabled=\"true\"></div><td class=\"cell-bottom\"><input class=\"fit textfield-border text-center\" ng-model=\"settings[SETTINGS.AMOUNT13]\"><tr><td><div select=\"\" list=\"groups\" selected=\"settings[SETTINGS.GROUP18]\" drop-down=\"true\"></div><td><div select=\"\" list=\"units\" selected=\"settings[SETTINGS.UNIT14]\" drop-down=\"true\"></div><td><div range-slider=\"\" min=\"settingsMap[SETTINGS.AMOUNT14].min\" max=\"settingsMap[SETTINGS.AMOUNT14].max\" value=\"settings[SETTINGS.AMOUNT14]\" enabled=\"true\"></div><td class=\"cell-bottom\"><input class=\"fit textfield-border text-center\" ng-model=\"settings[SETTINGS.AMOUNT14]\"><tr><td><div select=\"\" list=\"groups\" selected=\"settings[SETTINGS.GROUP19]\" drop-down=\"true\"></div><td><div select=\"\" list=\"units\" selected=\"settings[SETTINGS.UNIT15]\" drop-down=\"true\"></div><td><div range-slider=\"\" min=\"settingsMap[SETTINGS.AMOUNT15].min\" max=\"settingsMap[SETTINGS.AMOUNT15].max\" value=\"settings[SETTINGS.AMOUNT15]\" enabled=\"true\"></div><td class=\"cell-bottom\"><input class=\"fit textfield-border text-center\" ng-model=\"settings[SETTINGS.AMOUNT15]\"><tr><td><div select=\"\" list=\"groups\" selected=\"settings[SETTINGS.GROUP20]\" drop-down=\"true\"></div><td><div select=\"\" list=\"units\" selected=\"settings[SETTINGS.UNIT16]\" drop-down=\"true\"></div><td><div range-slider=\"\" min=\"settingsMap[SETTINGS.AMOUNT16].min\" max=\"settingsMap[SETTINGS.AMOUNT16].max\" value=\"settings[SETTINGS.AMOUNT16]\" enabled=\"true\"></div><td class=\"cell-bottom\"><input class=\"fit textfield-border text-center\" ng-model=\"settings[SETTINGS.AMOUNT16]\"><tr><td><div select=\"\" list=\"groups\" selected=\"settings[SETTINGS.GROUP21]\" drop-down=\"true\"></div><td><div select=\"\" list=\"units\" selected=\"settings[SETTINGS.UNIT17]\" drop-down=\"true\"></div><td><div range-slider=\"\" min=\"settingsMap[SETTINGS.AMOUNT17].min\" max=\"settingsMap[SETTINGS.AMOUNT17].max\" value=\"settings[SETTINGS.AMOUNT17]\" enabled=\"true\"></div><td class=\"cell-bottom\"><input class=\"fit textfield-border text-center\" ng-model=\"settings[SETTINGS.AMOUNT17]\"><tr><td><div select=\"\" list=\"groups\" selected=\"settings[SETTINGS.GROUP22]\" drop-down=\"true\"></div><td><div select=\"\" list=\"units\" selected=\"settings[SETTINGS.UNIT18]\" drop-down=\"true\"></div><td><div range-slider=\"\" min=\"settingsMap[SETTINGS.AMOUNT18].min\" max=\"settingsMap[SETTINGS.AMOUNT18].max\" value=\"settings[SETTINGS.AMOUNT18]\" enabled=\"true\"></div><td class=\"cell-bottom\"><input class=\"fit textfield-border text-center\" ng-model=\"settings[SETTINGS.AMOUNT18]\"><tr><td><div select=\"\" list=\"groups\" selected=\"settings[SETTINGS.GROUP23]\" drop-down=\"true\"></div><td><div select=\"\" list=\"units\" selected=\"settings[SETTINGS.UNIT19]\" drop-down=\"true\"></div><td><div range-slider=\"\" min=\"settingsMap[SETTINGS.AMOUNT19].min\" max=\"settingsMap[SETTINGS.AMOUNT19].max\" value=\"settings[SETTINGS.AMOUNT19]\" enabled=\"true\"></div><td class=\"cell-bottom\"><input class=\"fit textfield-border text-center\" ng-model=\"settings[SETTINGS.AMOUNT19]\"><tr><td><div select=\"\" list=\"groups\" selected=\"settings[SETTINGS.GROUP24]\" drop-down=\"true\"></div><td><div select=\"\" list=\"units\" selected=\"settings[SETTINGS.UNIT20]\" drop-down=\"true\"></div><td><div range-slider=\"\" min=\"settingsMap[SETTINGS.AMOUNT20].min\" max=\"settingsMap[SETTINGS.AMOUNT20].max\" value=\"settings[SETTINGS.AMOUNT20]\" enabled=\"true\"></div><td class=\"cell-bottom\"><input class=\"fit textfield-border text-center\" ng-model=\"settings[SETTINGS.AMOUNT20]\"></table></form></div><div class=\"rich-text\" ng-show=\"selectedTab === TAB_TYPES.LOGS\"><table class=\"tbl-border-light tbl-striped header-center\"><col width=\"40%\"><col width=\"30%\"><col width=\"5%\"><col width=\"25%\"><col><thead><tr><th>{{ 'village' | i18n:loc.ale:'recruit_queue' }}<th>{{ 'unit' | i18n:loc.ale:'recruit_queue' }}<th>{{ 'amount' | i18n:loc.ale:'recruit_queue' }}<th>{{ 'started' | i18n:loc.ale:'recruit_queue' }}<tbody class=\"recruitLog\"><tr class=\"noRecruits\"><td colspan=\"4\">{{ 'logs.noRecruits' | i18n:loc.ale:'recruit_queue' }}</table></div></div></div></div><footer class=\"win-foot\"><ul class=\"list-btn list-center\"><li ng-show=\"selectedTab === TAB_TYPES.PRESETS\"><a href=\"#\" class=\"btn-border btn-orange\" ng-click=\"\">{{ 'clear' | i18n:loc.ale:'recruit_queue' }}</a> <a href=\"#\" class=\"btn-border btn-orange\" ng-click=\"\">{{ 'start' | i18n:loc.ale:'recruit_queue' }}</a><li ng-show=\"selectedTab === TAB_TYPES.OWN\"><a href=\"#\" class=\"btn-border btn-orange\" ng-click=\"\">{{ 'clear' | i18n:loc.ale:'recruit_queue' }}</a> <a href=\"#\" class=\"btn-border btn-orange\" ng-click=\"\">{{ 'start' | i18n:loc.ale:'recruit_queue' }}</a><li ng-show=\"selectedTab === TAB_TYPES.LOGS\"><a href=\"#\" class=\"btn-border btn-orange\" ng-click=\"\">{{ 'clearL' | i18n:loc.ale:'recruit_queue' }}</a></ul></footer></div>`)
        interfaceOverflow.addStyle('#two-recruit-queue div[select]{float:right}#two-recruit-queue div[select] .select-handler{line-height:28px}#two-recruit-queue .range-container{width:250px}#two-recruit-queue .textfield-border{width:219px;height:34px;margin-bottom:2px;padding-top:2px}#two-recruit-queue .textfield-border.fit{width:100%}#two-recruit-queue .recruitLog td{text-align:center}#two-recruit-queue .recruitLog .village:hover{color:#fff;text-shadow:0 1px 0 #000}#two-recruit-queue table.header-center th{text-align:center}#two-recruit-queue .noRecruits td{height:26px;text-align:center}#two-recruit-queue .force-26to20{transform:scale(.8);width:20px;height:20px}')
    }

    const buildWindow = function () {
        $scope = $rootScope.$new()
        $scope.SETTINGS = SETTINGS
        $scope.TAB_TYPES = TAB_TYPES
        $scope.running = recruitQueue.isRunning()
        $scope.selectedTab = TAB_TYPES.PRESETS
        $scope.settingsMap = SETTINGS_MAP
        $scope.units = Settings.encodeList(RQ_UNIT, {
            textObject: 'recruit_queue',
            disabled: true
        })

        settings.injectScope($scope)
        eventHandlers.updatePresets()
        eventHandlers.updateGroups()

        $scope.selectTab = selectTab
        $scope.saveSettings = saveSettings
        $scope.switchState = switchState

        let eventScope = new EventScope('twoverflow_recruit_queue_window', function onDestroy () {
            console.log('example window closed')
        })

        eventScope.register(eventTypeProvider.ARMY_PRESET_UPDATE, eventHandlers.updatePresets, true)
        eventScope.register(eventTypeProvider.ARMY_PRESET_DELETED, eventHandlers.updatePresets, true)
        eventScope.register(eventTypeProvider.GROUPS_CREATED, eventHandlers.updateGroups, true)
        eventScope.register(eventTypeProvider.GROUPS_DESTROYED, eventHandlers.updateGroups, true)
        eventScope.register(eventTypeProvider.GROUPS_UPDATED, eventHandlers.updateGroups, true)
        eventScope.register(eventTypeProvider.recruit_queue_START, eventHandlers.start)
        eventScope.register(eventTypeProvider.recruit_queue_STOP, eventHandlers.stop)
        
        windowManagerService.getScreenWithInjectedScope('!twoverflow_recruit_queue_window', $scope)
    }

    return init
})

define('two/recruitQueue/settings', [], function() {
    return {
        GROUP1: 'group1',
        GROUP2: 'group2',
        GROUP3: 'group3',
        GROUP4: 'group4',
        GROUP5: 'group5',
        GROUP6: 'group6',
        GROUP7: 'group7',
        GROUP8: 'group8',
        GROUP9: 'group9',
        GROUP10: 'group10',
        GROUP11: 'group11',
        GROUP12: 'group12',
        GROUP13: 'group13',
        GROUP14: 'group14',
        GROUP15: 'group15',
        GROUP16: 'group16',
        GROUP17: 'group17',
        GROUP18: 'group18',
        GROUP19: 'group19',
        GROUP20: 'group20',
        GROUP21: 'group21',
        GROUP22: 'group22',
        GROUP23: 'group23',
        GROUP24: 'group24',
        UNIT1: 'unit1',
        UNIT2: 'unit2',
        UNIT3: 'unit3',
        UNIT4: 'unit4',
        UNIT5: 'unit5',
        UNIT6: 'unit6',
        UNIT7: 'unit7',
        UNIT8: 'unit8',
        UNIT9: 'unit9',
        UNIT10: 'unit10',
        UNIT11: 'unit11',
        UNIT12: 'unit12',
        UNIT13: 'unit13',
        UNIT14: 'unit14',
        UNIT15: 'unit15',
        UNIT16: 'unit16',
        UNIT17: 'unit17',
        UNIT18: 'unit18',
        UNIT19: 'unit19',
        UNIT20: 'unit20',
        AMOUNT1: 'amount1',
        AMOUNT2: 'amount2',
        AMOUNT3: 'amount3',
        AMOUNT4: 'amount4',
        AMOUNT5: 'amount5',
        AMOUNT6: 'amount6',
        AMOUNT7: 'amount7',
        AMOUNT8: 'amount8',
        AMOUNT9: 'amount9',
        AMOUNT10: 'amount10',
        AMOUNT11: 'amount11',
        AMOUNT12: 'amount12',
        AMOUNT13: 'amount13',
        AMOUNT14: 'amount14',
        AMOUNT15: 'amount15',
        AMOUNT16: 'amount16',
        AMOUNT17: 'amount17',
        AMOUNT18: 'amount18',
        AMOUNT19: 'amount19',
        AMOUNT20: 'amount20',
        PRESET1: 'preset1',
        PRESET2: 'preset2',
        PRESET3: 'preset3',
        PRESET4: 'preset4',
        PRESET1_FINAL: 'preset1_final',
        PRESET2_FINAL: 'preset1_final',
        PRESET3_FINAL: 'preset1_final',
        PRESET4_FINAL: 'preset1_final'
    }
})
define('two/recruitQueue/settings/updates', function() {
    return {
        PRESETS: 'presets',
        GROUPS: 'groups'
    }
})
define('two/recruitQueue/settings/map', [
    'two/recruitQueue/settings',
    'two/recruitQueue/settings/updates'
], function(
    SETTINGS,
    UPDATES
) {
    return {
        [SETTINGS.PRESET1]: {
            default: [],
            updates: [
                UPDATES.PRESETS
            ],
            disabledOption: true,
            inputType: 'select',
            multiSelect: true,
            type: 'presets'
        },
        [SETTINGS.PRESET2]: {
            default: [],
            updates: [
                UPDATES.PRESETS
            ],
            disabledOption: true,
            inputType: 'select',
            multiSelect: true,
            type: 'presets'
        },
        [SETTINGS.PRESET3]: {
            default: [],
            updates: [
                UPDATES.PRESETS
            ],
            disabledOption: true,
            inputType: 'select',
            multiSelect: true,
            type: 'presets'
        },
        [SETTINGS.PRESET4]: {
            default: [],
            updates: [
                UPDATES.PRESETS
            ],
            disabledOption: true,
            inputType: 'select',
            multiSelect: true,
            type: 'presets'
        },
        [SETTINGS.PRESET1_FINAL]: {
            default: [],
            updates: [
                UPDATES.PRESETS
            ],
            disabledOption: true,
            inputType: 'select',
            multiSelect: true,
            type: 'presets'
        },
        [SETTINGS.PRESET2_FINAL]: {
            default: [],
            updates: [
                UPDATES.PRESETS
            ],
            disabledOption: true,
            inputType: 'select',
            multiSelect: true,
            type: 'presets'
        },
        [SETTINGS.PRESET3_FINAL]: {
            default: [],
            updates: [
                UPDATES.PRESETS
            ],
            disabledOption: true,
            inputType: 'select',
            multiSelect: true,
            type: 'presets'
        },
        [SETTINGS.PRESET4_FINAL]: {
            default: [],
            updates: [
                UPDATES.PRESETS
            ],
            disabledOption: true,
            inputType: 'select',
            multiSelect: true,
            type: 'presets'
        },
        [SETTINGS.GROUP1]: {
            default: [],
            updates: [
                UPDATES.GROUPS,
            ],
            disabledOption: true,
            inputType: 'select',
            multiSelect: true,
            type: 'groups'
        },
        [SETTINGS.GROUP2]: {
            default: [],
            updates: [
                UPDATES.GROUPS,
            ],
            disabledOption: true,
            inputType: 'select',
            multiSelect: true,
            type: 'groups'
        },
        [SETTINGS.GROUP3]: {
            default: [],
            updates: [
                UPDATES.GROUPS,
            ],
            disabledOption: true,
            inputType: 'select',
            multiSelect: true,
            type: 'groups'
        },
        [SETTINGS.GROUP4]: {
            default: [],
            updates: [
                UPDATES.GROUPS,
            ],
            disabledOption: true,
            inputType: 'select',
            multiSelect: true,
            type: 'groups'
        },
        [SETTINGS.GROUP5]: {
            default: [],
            updates: [
                UPDATES.GROUPS,
            ],
            disabledOption: true,
            inputType: 'select',
            multiSelect: true,
            type: 'groups'
        },
        [SETTINGS.GROUP6]: {
            default: [],
            updates: [
                UPDATES.GROUPS,
            ],
            disabledOption: true,
            inputType: 'select',
            multiSelect: true,
            type: 'groups'
        },
        [SETTINGS.GROUP7]: {
            default: [],
            updates: [
                UPDATES.GROUPS,
            ],
            disabledOption: true,
            inputType: 'select',
            multiSelect: true,
            type: 'groups'
        },
        [SETTINGS.GROUP8]: {
            default: [],
            updates: [
                UPDATES.GROUPS,
            ],
            disabledOption: true,
            inputType: 'select',
            multiSelect: true,
            type: 'groups'
        },
        [SETTINGS.GROUP9]: {
            default: [],
            updates: [
                UPDATES.GROUPS,
            ],
            disabledOption: true,
            inputType: 'select',
            multiSelect: true,
            type: 'groups'
        },
        [SETTINGS.GROUP10]: {
            default: [],
            updates: [
                UPDATES.GROUPS,
            ],
            disabledOption: true,
            inputType: 'select',
            multiSelect: true,
            type: 'groups'
        },
        [SETTINGS.GROUP11]: {
            default: [],
            updates: [
                UPDATES.GROUPS,
            ],
            disabledOption: true,
            inputType: 'select',
            multiSelect: true,
            type: 'groups'
        },
        [SETTINGS.GROUP12]: {
            default: [],
            updates: [
                UPDATES.GROUPS,
            ],
            disabledOption: true,
            inputType: 'select',
            multiSelect: true,
            type: 'groups'
        },
        [SETTINGS.GROUP13]: {
            default: [],
            updates: [
                UPDATES.GROUPS,
            ],
            disabledOption: true,
            inputType: 'select',
            multiSelect: true,
            type: 'groups'
        },
        [SETTINGS.GROUP14]: {
            default: [],
            updates: [
                UPDATES.GROUPS,
            ],
            disabledOption: true,
            inputType: 'select',
            multiSelect: true,
            type: 'groups'
        },
        [SETTINGS.GROUP15]: {
            default: [],
            updates: [
                UPDATES.GROUPS,
            ],
            disabledOption: true,
            inputType: 'select',
            multiSelect: true,
            type: 'groups'
        },
        [SETTINGS.GROUP16]: {
            default: [],
            updates: [
                UPDATES.GROUPS,
            ],
            disabledOption: true,
            inputType: 'select',
            multiSelect: true,
            type: 'groups'
        },
        [SETTINGS.GROUP17]: {
            default: [],
            updates: [
                UPDATES.GROUPS,
            ],
            disabledOption: true,
            inputType: 'select',
            multiSelect: true,
            type: 'groups'
        },
        [SETTINGS.GROUP18]: {
            default: [],
            updates: [
                UPDATES.GROUPS,
            ],
            disabledOption: true,
            inputType: 'select',
            multiSelect: true,
            type: 'groups'
        },
        [SETTINGS.GROUP19]: {
            default: [],
            updates: [
                UPDATES.GROUPS,
            ],
            disabledOption: true,
            inputType: 'select',
            multiSelect: true,
            type: 'groups'
        },
        [SETTINGS.GROUP20]: {
            default: [],
            updates: [
                UPDATES.GROUPS,
            ],
            disabledOption: true,
            inputType: 'select',
            multiSelect: true,
            type: 'groups'
        },
        [SETTINGS.GROUP21]: {
            default: [],
            updates: [
                UPDATES.GROUPS,
            ],
            disabledOption: true,
            inputType: 'select',
            multiSelect: true,
            type: 'groups'
        },
        [SETTINGS.GROUP22]: {
            default: [],
            updates: [
                UPDATES.GROUPS,
            ],
            disabledOption: true,
            inputType: 'select',
            multiSelect: true,
            type: 'groups'
        },
        [SETTINGS.GROUP23]: {
            default: [],
            updates: [
                UPDATES.GROUPS,
            ],
            disabledOption: true,
            inputType: 'select',
            multiSelect: true,
            type: 'groups'
        },
        [SETTINGS.GROUP24]: {
            default: [],
            updates: [
                UPDATES.GROUPS,
            ],
            disabledOption: true,
            inputType: 'select',
            multiSelect: true,
            type: 'groups'
        },
        [SETTINGS.AMOUNT1]: {
            default: 1,
            inputType: 'number',
            min: 1,
            max: 24000
        },
        [SETTINGS.AMOUNT2]: {
            default: 1,
            inputType: 'number',
            min: 1,
            max: 24000
        },
        [SETTINGS.AMOUNT3]: {
            default: 1,
            inputType: 'number',
            min: 1,
            max: 24000
        },
        [SETTINGS.AMOUNT4]: {
            default: 1,
            inputType: 'number',
            min: 1,
            max: 24000
        },
        [SETTINGS.AMOUNT5]: {
            default: 1,
            inputType: 'number',
            min: 1,
            max: 24000
        },
        [SETTINGS.AMOUNT6]: {
            default: 1,
            inputType: 'number',
            min: 1,
            max: 24000
        },
        [SETTINGS.AMOUNT7]: {
            default: 1,
            inputType: 'number',
            min: 1,
            max: 24000
        },
        [SETTINGS.AMOUNT8]: {
            default: 1,
            inputType: 'number',
            min: 1,
            max: 24000
        },
        [SETTINGS.AMOUNT9]: {
            default: 1,
            inputType: 'number',
            min: 1,
            max: 24000
        },
        [SETTINGS.AMOUNT10]: {
            default: 1,
            inputType: 'number',
            min: 1,
            max: 24000
        },
        [SETTINGS.AMOUNT11]: {
            default: 1,
            inputType: 'number',
            min: 1,
            max: 24000
        },
        [SETTINGS.AMOUNT12]: {
            default: 1,
            inputType: 'number',
            min: 1,
            max: 24000
        },
        [SETTINGS.AMOUNT13]: {
            default: 1,
            inputType: 'number',
            min: 1,
            max: 24000
        },
        [SETTINGS.AMOUNT14]: {
            default: 1,
            inputType: 'number',
            min: 1,
            max: 24000
        },
        [SETTINGS.AMOUNT15]: {
            default: 1,
            inputType: 'number',
            min: 1,
            max: 24000
        },
        [SETTINGS.AMOUNT16]: {
            default: 1,
            inputType: 'number',
            min: 1,
            max: 24000
        },
        [SETTINGS.AMOUNT17]: {
            default: 1,
            inputType: 'number',
            min: 1,
            max: 24000
        },
        [SETTINGS.AMOUNT18]: {
            default: 1,
            inputType: 'number',
            min: 1,
            max: 24000
        },
        [SETTINGS.AMOUNT19]: {
            default: 1,
            inputType: 'number',
            min: 1,
            max: 24000
        },
        [SETTINGS.AMOUNT20]: {
            default: 1,
            inputType: 'number',
            min: 1,
            max: 24000
        },
        [SETTINGS.UNIT1]: {
            default: false,
            disabledOption: true,
            inputType: 'select'
        },
        [SETTINGS.UNIT2]: {
            default: false,
            disabledOption: true,
            inputType: 'select'
        },
        [SETTINGS.UNIT3]: {
            default: false,
            disabledOption: true,
            inputType: 'select'
        },
        [SETTINGS.UNIT4]: {
            default: false,
            disabledOption: true,
            inputType: 'select'
        },
        [SETTINGS.UNIT5]: {
            default: false,
            disabledOption: true,
            inputType: 'select'
        },
        [SETTINGS.UNIT6]: {
            default: false,
            disabledOption: true,
            inputType: 'select'
        },
        [SETTINGS.UNIT7]: {
            default: false,
            disabledOption: true,
            inputType: 'select'
        },
        [SETTINGS.UNIT8]: {
            default: false,
            disabledOption: true,
            inputType: 'select'
        },
        [SETTINGS.UNIT9]: {
            default: false,
            disabledOption: true,
            inputType: 'select'
        },
        [SETTINGS.UNIT10]: {
            default: false,
            disabledOption: true,
            inputType: 'select'
        },
        [SETTINGS.UNIT11]: {
            default: false,
            disabledOption: true,
            inputType: 'select'
        },
        [SETTINGS.UNIT12]: {
            default: false,
            disabledOption: true,
            inputType: 'select'
        },
        [SETTINGS.UNIT13]: {
            default: false,
            disabledOption: true,
            inputType: 'select'
        },
        [SETTINGS.UNIT14]: {
            default: false,
            disabledOption: true,
            inputType: 'select'
        },
        [SETTINGS.UNIT15]: {
            default: false,
            disabledOption: true,
            inputType: 'select'
        },
        [SETTINGS.UNIT16]: {
            default: false,
            disabledOption: true,
            inputType: 'select'
        },
        [SETTINGS.UNIT17]: {
            default: false,
            disabledOption: true,
            inputType: 'select'
        },
        [SETTINGS.UNIT18]: {
            default: false,
            disabledOption: true,
            inputType: 'select'
        },
        [SETTINGS.UNIT19]: {
            default: false,
            disabledOption: true,
            inputType: 'select'
        },
        [SETTINGS.UNIT20]: {
            default: false,
            disabledOption: true,
            inputType: 'select'
        }
    }
})
define('two/recruitQueue/types/units', [], function () {
    return {
        SPEAR: 'spear',
        SWORD: 'sword',
        AXE: 'axe',
        ARCHER: 'archer',
        LIGHT_CAVALRY: 'light_cavalry',
        MOUNTED_ARCHER: 'mounted_archer',
        HEAVY_CAVALRY: 'heavy_cavalry',
        RAM: 'ram',
        CATAPULT: 'catapult',
        TREBUCHET: 'trebuchet',
        DOPPELSOLDNER: 'doppelsoldner',
        SNOB: 'snob',
        KNIGHT: 'knight'
    }
})
require([
    'two/ready',
    'two/recruitQueue',
    'two/recruitQueue/ui',
    'two/recruitQueue/events'
], function (
    ready,
    recruitQueue,
    recruitQueueInterface
) {
    if (recruitQueue.isInitialized()) {
        return false
    }

    ready(function () {
        recruitQueue.init()
        recruitQueueInterface()
    })
})

define('two/reportHelper', [
    'two/Settings',
    'two/reportHelper/settings',
    'two/reportHelper/settings/map',
    'two/reportHelper/settings/updates',
    'two/ready',
    'queues/EventQueue'
], function (
    Settings,
    SETTINGS,
    SETTINGS_MAP,
    UPDATES,
    ready,
    eventQueue
) {
    let initialized = false
    let running = false
    let settings
    let reportHelperSettings

    let selectedPresets = []
    let selectedGroups = []

    const STORAGE_KEYS = {
        SETTINGS: 'report_helper_settings'
    }

    const updatePresets = function () {
        selectedPresets = []

        const allPresets = modelDataService.getPresetList().getPresets()
        const presetsSelectedByTheUser = reportHelperSettings[SETTINGS.PRESETS]

        presetsSelectedByTheUser.forEach(function (presetId) {
            selectedPresets.push(allPresets[presetId])
        })

        console.log('selectedPresets', selectedPresets)
    }

    const updateGroups = function () {
        selectedGroups = []

        const allGroups = modelDataService.getGroupList().getGroups()
        const groupsSelectedByTheUser = reportHelperSettings[SETTINGS.GROUPS]

        groupsSelectedByTheUser.forEach(function (groupId) {
            selectedGroups.push(allGroups[groupId])
        })

        console.log('selectedGroups', selectedGroups)
    }

    const examplePublicFunctions = {}

    examplePublicFunctions.init = function () {
        initialized = true

        settings = new Settings({
            settingsMap: SETTINGS_MAP,
            storageKey: STORAGE_KEYS.SETTINGS
        })

        settings.onChange(function (changes, updates) {
            reportHelperSettings = settings.getAll()

            // here you can handle settings that get modified and need
            // some processing. Useful to not break the script when updated
            // while running.

            if (updates[UPDATES.PRESETS]) {
                updatePresets()
            }

            if (updates[UPDATES.GROUPS]) {
                updateGroups()
            }
        })

        reportHelperSettings = settings.getAll()

        console.log('all settings', reportHelperSettings)

        ready(function () {
            updatePresets()
        }, 'presets')

        $rootScope.$on(eventTypeProvider.ARMY_PRESET_UPDATE, updatePresets)
        $rootScope.$on(eventTypeProvider.ARMY_PRESET_DELETED, updatePresets)
        $rootScope.$on(eventTypeProvider.GROUPS_CREATED, updateGroups)
        $rootScope.$on(eventTypeProvider.GROUPS_DESTROYED, updateGroups)
        $rootScope.$on(eventTypeProvider.GROUPS_UPDATED, updateGroups)
    }

    examplePublicFunctions.start = function () {
        running = true

        console.log('selectedPresets', selectedPresets)
        console.log('selectedGroups', selectedGroups)

        eventQueue.trigger(eventTypeProvider.REPORT_HELPER_START)
    }

    examplePublicFunctions.stop = function () {
        running = false

        console.log('example module stop')

        eventQueue.trigger(eventTypeProvider.REPORT_HELPER_STOP)
    }

    examplePublicFunctions.getSettings = function () {
        return settings
    }

    examplePublicFunctions.isInitialized = function () {
        return initialized
    }

    examplePublicFunctions.isRunning = function () {
        return running
    }

    return examplePublicFunctions
})

define('two/reportHelper/events', [], function () {
    angular.extend(eventTypeProvider, {
        REPORT_HELPER_START: 'report_helper_start',
        REPORT_HELPER_STOP: 'report_helper_stop'
    })
})

define('two/reportHelper/ui', [
    'two/ui',
    'two/reportHelper',
    'two/reportHelper/settings',
    'two/reportHelper/settings/map',
    'two/Settings',
    'two/EventScope',
    'two/utils'
], function (
    interfaceOverflow,
    reportHelper,
    SETTINGS,
    SETTINGS_MAP,
    Settings,
    EventScope,
    utils
) {
    let $scope
    let settings
    let presetList = modelDataService.getPresetList()
    let groupList = modelDataService.getGroupList()
    let $button
    
    const TAB_TYPES = {
        SETTINGS: 'settings',
        SOME_VIEW: 'some_view'
    }

    const selectTab = function (tabType) {
        $scope.selectedTab = tabType
    }

    const saveSettings = function () {
        settings.setAll(settings.decode($scope.settings))

        utils.notif('success', 'Settings saved')
    }

    const switchState = function () {
        if (reportHelper.isRunning()) {
            reportHelper.stop()
        } else {
            reportHelper.start()
        }
    }

    const eventHandlers = {
        updatePresets: function () {
            $scope.presets = Settings.encodeList(presetList.getPresets(), {
                disabled: false,
                type: 'presets'
            })
        },
        updateGroups: function () {
            $scope.groups = Settings.encodeList(groupList.getGroups(), {
                disabled: false,
                type: 'groups'
            })
        },
        start: function () {
            $scope.running = true

            $button.classList.remove('btn-orange')
            $button.classList.add('btn-red')

            utils.notif('success', 'Example module started')
        },
        stop: function () {
            $scope.running = false

            $button.classList.remove('btn-red')
            $button.classList.add('btn-orange')

            utils.notif('success', 'Example module stopped')
        }
    }

    const init = function () {
        settings = reportHelper.getSettings()
        $button = interfaceOverflow.addMenuButton3('Skryba', 70)
        $button.addEventListener('click', buildWindow)

        interfaceOverflow.addTemplate('twoverflow_report_helper_window', `<div id=\"two-example-module\" class=\"win-content two-window\"><header class=\"win-head\"><h2>Example Module</h2><ul class=\"list-btn\"><li><a href=\"#\" class=\"size-34x34 btn-red icon-26x26-close\" ng-click=\"closeWindow()\"></a></ul></header><div class=\"win-main\" scrollbar=\"\"><div class=\"tabs tabs-bg\"><div class=\"tabs-two-col\"><div class=\"tab\" ng-click=\"selectTab(TAB_TYPES.SETTINGS)\" ng-class=\"{'tab-active': selectedTab == TAB_TYPES.SETTINGS}\"><div class=\"tab-inner\"><div ng-class=\"{'box-border-light': selectedTab === TAB_TYPES.SETTINGS}\"><a href=\"#\" ng-class=\"{'btn-icon btn-orange': selectedTab !== TAB_TYPES.SETTINGS}\">{{ TAB_TYPES.SETTINGS | i18n:loc.ale:'common' }}</a></div></div></div><div class=\"tab\" ng-click=\"selectTab(TAB_TYPES.SOME_VIEW)\" ng-class=\"{'tab-active': selectedTab == TAB_TYPES.SOME_VIEW}\"><div class=\"tab-inner\"><div ng-class=\"{'box-border-light': selectedTab === TAB_TYPES.SOME_VIEW}\"><a href=\"#\" ng-class=\"{'btn-icon btn-orange': selectedTab !== TAB_TYPES.SOME_VIEW}\">{{ TAB_TYPES.SOME_VIEW | i18n:loc.ale:'exmaple_module' }}</a></div></div></div></div></div><div class=\"box-paper footer\"><div class=\"scroll-wrap\"><div class=\"settings\" ng-show=\"selectedTab === TAB_TYPES.SETTINGS\"><table class=\"tbl-border-light tbl-content tbl-medium-height\"><col><col width=\"200px\"><col width=\"60px\"><tr><th colspan=\"3\">{{ 'groups' | i18n:loc.ale:'example_module' }}<tr><td><span class=\"ff-cell-fix\">{{ 'presets' | i18n:loc.ale:'example_module' }}</span><td colspan=\"2\"><div select=\"\" list=\"presets\" selected=\"settings[SETTINGS.PRESETS]\" drop-down=\"true\"></div><tr><td><span class=\"ff-cell-fix\">{{ 'groups' | i18n:loc.ale:'example_module' }}</span><td colspan=\"2\"><div select=\"\" list=\"groups\" selected=\"settings[SETTINGS.GROUPS]\" drop-down=\"true\"></div><tr><td><span class=\"ff-cell-fix\">{{ 'some_number' | i18n:loc.ale:'example_module' }}</span><td><div range-slider=\"\" min=\"settingsMap[SETTINGS.SOME_NUMBER].min\" max=\"settingsMap[SETTINGS.SOME_NUMBER].max\" value=\"settings[SETTINGS.SOME_NUMBER]\" enabled=\"true\"></div><td class=\"cell-bottom\"><input class=\"fit textfield-border text-center\" ng-model=\"settings[SETTINGS.SOME_NUMBER]\"></table></div><div class=\"rich-text\" ng-show=\"selectedTab === TAB_TYPES.SOME_VIEW\"><h5 class=\"twx-section\">some view</h5></div></div></div></div><footer class=\"win-foot\"><ul class=\"list-btn list-center\"><li ng-show=\"selectedTab === TAB_TYPES.SETTINGS\"><a href=\"#\" class=\"btn-border btn-red\" ng-click=\"saveSettings()\">{{ 'save' | i18n:loc.ale:'common' }}</a><li ng-show=\"selectedTab === TAB_TYPES.SOME_VIEW\"><a href=\"#\" class=\"btn-border btn-orange\" ng-click=\"someViewAction()\">{{ 'some_view_action' | i18n:loc.ale:'example_module' }}</a><li><a href=\"#\" ng-class=\"{false:'btn-green', true:'btn-red'}[running]\" class=\"btn-border\" ng-click=\"switchState()\"><span ng-show=\"running\">{{ 'pause' | i18n:loc.ale:'common' }}</span> <span ng-show=\"!running\">{{ 'start' | i18n:loc.ale:'common' }}</span></a></ul></footer></div>`)
        interfaceOverflow.addStyle('#two-example-module div[select]{float:right}#two-example-module div[select] .select-handler{line-height:28px}#two-example-module .range-container{width:250px}#two-example-module .textfield-border{width:219px;height:34px;margin-bottom:2px;padding-top:2px}#two-example-module .textfield-border.fit{width:100%}')
    }

    const buildWindow = function () {
        $scope = $rootScope.$new()
        $scope.SETTINGS = SETTINGS
        $scope.TAB_TYPES = TAB_TYPES
        $scope.running = reportHelper.isRunning()
        $scope.selectedTab = TAB_TYPES.SETTINGS
        $scope.settingsMap = SETTINGS_MAP

        settings.injectScope($scope)
        eventHandlers.updatePresets()
        eventHandlers.updateGroups()

        $scope.selectTab = selectTab
        $scope.saveSettings = saveSettings
        $scope.switchState = switchState

        let eventScope = new EventScope('twoverflow_report_helper_window', function onDestroy () {
            console.log('example window closed')
        })

        // all those event listeners will be destroyed as soon as the window gets closed
        eventScope.register(eventTypeProvider.ARMY_PRESET_UPDATE, eventHandlers.updatePresets, true /*true = native game event*/)
        eventScope.register(eventTypeProvider.ARMY_PRESET_DELETED, eventHandlers.updatePresets, true)
        eventScope.register(eventTypeProvider.GROUPS_CREATED, eventHandlers.updateGroups, true)
        eventScope.register(eventTypeProvider.GROUPS_DESTROYED, eventHandlers.updateGroups, true)
        eventScope.register(eventTypeProvider.GROUPS_UPDATED, eventHandlers.updateGroups, true)
        eventScope.register(eventTypeProvider.REPORT_HELPER_START, eventHandlers.start)
        eventScope.register(eventTypeProvider.REPORT_HELPER_STOP, eventHandlers.stop)
        
        windowManagerService.getScreenWithInjectedScope('!twoverflow_report_helper_window', $scope)
    }

    return init
})

define('two/reportHelper/settings', [], function () {
    return {
        PRESETS: 'presets',
        GROUPS: 'groups',
        SOME_NUMBER: 'some_number'
    }
})

define('two/reportHelper/settings/updates', function () {
    return {
        PRESETS: 'presets',
        GROUPS: 'groups'
    }
})

define('two/reportHelper/settings/map', [
    'two/reportHelper/settings',
    'two/reportHelper/settings/updates'
], function (
    SETTINGS,
    UPDATES
) {
    return {
        [SETTINGS.PRESETS]: {
            default: [],
            updates: [
                UPDATES.PRESETS
            ],
            disabledOption: true,
            inputType: 'select',
            multiSelect: true,
            type: 'presets'
        },
        [SETTINGS.GROUPS]: {
            default: [],
            updates: [
                UPDATES.GROUPS,
            ],
            disabledOption: true,
            inputType: 'select',
            multiSelect: true,
            type: 'groups'
        },
        [SETTINGS.SOME_NUMBER]: {
            default: 60,
            inputType: 'number',
            min: 0,
            max: 120
        }
    }
})

require([
    'two/ready',
    'two/reportHelper',
    'two/reportHelper/ui',
    'two/reportHelper/events'
], function (
    ready,
    reportHelper,
    reportHelperInterface
) {
    if (reportHelper.isInitialized()) {
        return false
    }

    ready(function () {
        reportHelper.init()
        reportHelperInterface()
    })
})

define('two/reportSender', [
    'queues/EventQueue'
], function(
    eventQueue
) {
    var player = modelDataService.getSelectedCharacter()
    var playerId = player.data.character_id
    var playerName = player.data.character_name
    var initialized = false
    var running = false
    var scoutReportsId = []
    var defenseReportsId = []
    var attackReportsId = []
    var convert

    function secondsToDaysHHMMSS(totalSeconds) {
        var returnString = ''
        var date = new Date(totalSeconds * 1000)
        convert = date.toLocaleString()
        returnString = convert
        return returnString
    }

    var checkNewReports = function() {
        socketService.emit(routeProvider.REPORT_GET_LIST_REVERSE, {
            offset: 0,
            count: 50,
            query: '',
            types: ['scouting']
        }, function(data) {
            var reports = data.reports
            for (var i = 0; i < reports.length; i++) {
                if (scoutReportsId.includes(reports[i].id)) {
                    console.log('Raport zwiadowczy już wysłany')
                } else {
                    scoutReportsId.push(reports[i].id)
                    socketService.emit(routeProvider.REPORT_GET, {
                        id: reports[i].id
                    }, sendInfoScout)
                }
            }
        })

        socketService.emit(routeProvider.REPORT_GET_LIST_REVERSE, {
            offset: 0,
            count: 100,
            query: '',
            types: ['defense']
        }, function(data) {
            var reports = data.reports
            for (var i = 0; i < reports.length; i++) {
                if (defenseReportsId.includes(reports[i].id)) {
                    console.log('Raport wsparcia już wysłany')
                } else {
                    defenseReportsId.push(reports[i].id)
                    socketService.emit(routeProvider.REPORT_GET, {
                        id: reports[i].id
                    }, sendInfoDefense)
                }
            }
        })

        socketService.emit(routeProvider.REPORT_GET_LIST_REVERSE, {
            offset: 0,
            count: 100,
            query: '',
            types: ['attack']
        }, function(data) {
            var reports = data.reports
            for (var i = 0; i < reports.length; i++) {
                if (attackReportsId.includes(reports[i].id)) {
                    console.log('Raport ataku już wysłany')
                } else {
                    attackReportsId.push(reports[i].id)
                    socketService.emit(routeProvider.REPORT_GET, {
                        id: reports[i].id
                    }, sendInfoAttack)
                }
            }
        })

        setTimeout(checkNewReports, 30000)
    }

    var sendInfoScout = function sendInfoScout(data) {
        var alertText = []
        var result = data.result
        var token = data.token
        var time
        var timecreated = data.time_created
        var finalTime = secondsToDaysHHMMSS(timecreated)
        var details = data.ReportScouting
        var attCharacterId = details.attCharacterId
        var attCharacterName = details.attCharacterName
        var attScouts = details.attScouts
        var attLosses = details.attLosses
        var attVillageId = details.attVillageId
        var attVillageName = details.attVillageName
        var defCharacterId = details.defCharacterId
        var defCharacterName = details.defCharacterName
        var defLosses = details.defLosses
        var defScouts = details.defScouts
        var defScoutsFinal
        var attScoutsFinal
        var defScoutsLossesFinal
        var attScoutsLossesFinal
        var defVillageId = details.defVillageId
        var defVillageName = details.defVillageName
        var commandType = details.commandType
        var resultString = ''
        var type = ''
        var origin = ''
        var gamer = ''
        var dateNow = Date.now()
        var newToken = token.split('.').join('_')
        if (result == 2) {
            resultString = ' [color=d96a19]Częściowy sukces[/color]'
        } else if (result == 1) {
            resultString = ' [color=0a8028]Sukces[/color]'
        } else if (result == 3) {
            resultString = ' [color=e21f1f]Porażka[/color]'
        }
        if (commandType == 'units') {
            type = 'Jednostki'
        } else if (commandType == 'buildings') {
            type = 'Budynki'
        } else {
            type = 'Sabotaż'
        }
        if (defScouts == null) {
            defScoutsFinal = 'nieznana'
        } else {
            defScoutsFinal = defScouts
        }
        if (attScouts == null) {
            attScoutsFinal = 'nieznana'
        } else {
            attScoutsFinal = attScouts
        }
        if (defLosses == null) {
            defScoutsLossesFinal = 'nieznana'
        } else {
            defScoutsLossesFinal = defLosses
        }
        if (attLosses == null) {
            attScoutsLossesFinal = 'nieznana'
        } else {
            attScoutsLossesFinal = attLosses
        }
        if (attCharacterName == null && attCharacterId == null) {
            gamer = 'Brak danych'
        } else {
            gamer = '[player=' + attCharacterId + ']' + attCharacterName + '[/player]'
        }
        if (attVillageName == null && attVillageId == null) {
            origin = 'Brak danych'
        } else {
            origin = '[village=' + attVillageId + ']' + attVillageName + '[/village]'
        }
        time = Math.floor((dateNow / 1000) - timecreated)

        alertText.push('[size=XL][b]Raport szpiegowski: [report]' + newToken + '[/report][br]' + resultString + ' --- Typ: ' + type + '[/b][/size][br][b][size=large] Czas wejścia szpiegów: ' + finalTime + '[/size][/b][br][size=medium][b] Wioska cel: [/b][village=' + defVillageId + ']' + defVillageName + '[/village][b] Gracz cel: [/b][player=' + defCharacterId + ']' + defCharacterName + '[/player][br]Liczba szpiegów: [b]' + defScoutsFinal + '[/b] Stracone: [b][color=e21f1f]' + defScoutsLossesFinal + '[/color][/b][br]Wioska pochodzenia: [/b]' + origin + '[b] Gracz szpiegujący: [/b]' + gamer + '[br]Liczba szpiegów: [b]' + attScoutsFinal + '[/b] Stracone: [b][color=e21f1f]' + attScoutsLossesFinal + '[/color][/b][/size]')
        var message = alertText.join()
        if (defCharacterId != playerId) {
            if (time < 10800) {
                if (playerName == 'Hajduk Split' || playerName == 'halfsack' || playerName == 'Black Rider') {
                    socketService.emit(routeProvider.MESSAGE_REPLY, {
                        message_id: 14383,
                        message: message
                    })
                } else {
                    socketService.emit(routeProvider.MESSAGE_REPLY, {
                        message_id: 6467,
                        message: message
                    })
                }
                alertText = []
            }
        } else {
            if (time < 10800) {
                if (playerName == 'Hajduk Split' || playerName == 'halfsack' || playerName == 'Black Rider') {
                    socketService.emit(routeProvider.MESSAGE_REPLY, {
                        message_id: 14382,
                        message: message
                    })
                } else {
                    socketService.emit(routeProvider.MESSAGE_REPLY, {
                        message_id: 6466,
                        message: message
                    })
                }
                alertText = []
            }
        }
    }

    var sendInfoDefense = function sendInfoDefense(data) {
        var alertText = []
        var result = data.result
        var token = data.token
        var time
        var timecreated = data.time_created
        var finalTime = secondsToDaysHHMMSS(timecreated)
        var details = data.ReportAttack
        var attCharacterId = details.attCharacterId
        var attCharacterName = details.attCharacterName
        var attVillageId = details.attVillageId
        var attVillageName = details.attVillageName
        var attEffects = details.attEffects
        var defEffects = details.defEffects
        var attUnits = details.attUnits
        var noFake = attUnits.spear + attUnits.sword + attUnits.axe + attUnits.archer + attUnits.light_cavalry + attUnits.mounted_archer + attUnits.ram + attUnits.catapult + attUnits.heavy_cavalry + attUnits.trebuchet + attUnits.knight + attUnits.snob + attUnits.doppelsoldner
        if (noFake > 30) {
            var EffectsForAttacker = []
            var EffectsForDefender = []
            attEffects.forEach(function(effect) {
                var type = effect.type
                var factorICC = 0
                var minlevelBWL = 0
                var bonusMAF = 0
                var ratioRAL = 0
                var bedsEHB = 0
                var increasedByISD = 0
                var increasedByIML = 0
                var factorRSB = 0
                var factorFSI = 0
                var factorRDJA = 0
                var factorRDJD = 0
                var factorFTS = 0
                if (type == 'increased_carrying_capacity') {
                    factorICC = ((effect.factor - 1) * 100).toFixed([0])
                    EffectsForAttacker.push(' Wagony ' + factorICC + '%')
                }
                if (type == 'base_wall_levels') {
                    minlevelBWL = effect.min_level
                    EffectsForAttacker.push(' Żelazny mur ' + minlevelBWL + '')
                }
                if (type == 'modify_attack_factor') {
                    bonusMAF = effect.bonus * 100
                    EffectsForAttacker.push(' Mistrzostwo broni ' + bonusMAF + '%')
                }
                if (type == 'revive_attacker_losses') {
                    ratioRAL = effect.ratio * 100
                    EffectsForAttacker.push(' Doktor ' + ratioRAL + '%')
                }
                if (type == 'extra_hospital_beds') {
                    bedsEHB = effect.beds
                    EffectsForAttacker.push(' Klinika ' + bedsEHB + '')
                }
                if (type == 'increase_spy_defense') {
                    increasedByISD = effect.increased_by
                    EffectsForAttacker.push(' Agent wewnętrzny ' + increasedByISD + '%')
                }
                if (type == 'increase_member_limit') {
                    increasedByIML = effect.increased_by
                    EffectsForAttacker.push(' Siła w liczbach ' + increasedByIML + '')
                }
                if (type == 'recruit_speed_boost') {
                    factorRSB = effect.factor
                    EffectsForAttacker.push(' Intensywny trening ' + factorRSB + '%')
                }
                if (type == 'farm_speed_increase') {
                    factorFSI = effect.factor
                    EffectsForAttacker.push(' Drogi najazdów ' + factorFSI + '%')
                }
                if (type == 'resource_deposit_job_amount') {
                    factorRDJA = effect.factor
                    EffectsForAttacker.push(' Wagony(depozyt) ' + factorRDJA + '%')
                }
                if (type == 'resource_deposit_job_duration') {
                    factorRDJD = effect.factor
                    EffectsForAttacker.push(' Drogi najazdów(depozyt) ' + factorRDJD + '%')
                }
                if (type == 'faster_tribe_support') {
                    factorFTS = effect.factor
                    EffectsForAttacker.push(' Zjednoczenie ' + factorFTS + '%')
                }
            })
            var finishedAttEffects = EffectsForAttacker.join()
            defEffects.forEach(function(effect) {
                var type = effect.type
                var factorICC = 0
                var minlevelBWL = 0
                var bonusMAF = 0
                var ratioRAL = 0
                var bedsEHB = 0
                var increasedByISD = 0
                var increasedByIML = 0
                var factorRSB = 0
                var factorFSI = 0
                var factorRDJA = 0
                var factorRDJD = 0
                var factorFTS = 0
                if (type == 'increased_carrying_capacity') {
                    factorICC = ((effect.factor - 1) * 100).toFixed([0])
                    EffectsForDefender.push(' Wagony ' + factorICC + '%')
                }
                if (type == 'base_wall_levels') {
                    minlevelBWL = effect.min_level
                    EffectsForDefender.push(' Żelazny mur ' + minlevelBWL + '')
                }
                if (type == 'modify_attack_factor') {
                    bonusMAF = effect.bonus * 100
                    EffectsForDefender.push(' Mistrzostwo broni ' + bonusMAF + '%')
                }
                if (type == 'revive_attacker_losses') {
                    ratioRAL = effect.ratio * 100
                    EffectsForDefender.push(' Doktor ' + ratioRAL + '%')
                }
                if (type == 'extra_hospital_beds') {
                    bedsEHB = effect.beds
                    EffectsForDefender.push(' Klinika ' + bedsEHB + '')
                }
                if (type == 'increase_spy_defense') {
                    increasedByISD = effect.increased_by
                    EffectsForDefender.push(' Agent wewnętrzny ' + increasedByISD + '%')
                }
                if (type == 'increase_member_limit') {
                    increasedByIML = effect.increased_by
                    EffectsForDefender.push(' Siła w liczbach ' + increasedByIML + '')
                }
                if (type == 'recruit_speed_boost') {
                    factorRSB = effect.factor
                    EffectsForDefender.push(' Intensywny trening ' + factorRSB + '%')
                }
                if (type == 'farm_speed_increase') {
                    factorFSI = effect.factor
                    EffectsForDefender.push(' Drogi najazdów ' + factorFSI + '%')
                }
                if (type == 'resource_deposit_job_amount') {
                    factorRDJA = effect.factor
                    EffectsForDefender.push(' Wagony(depozyt) ' + factorRDJA + '%')
                }
                if (type == 'resource_deposit_job_duration') {
                    factorRDJD = effect.factor
                    EffectsForDefender.push(' Drogi najazdów(depozyt) ' + factorRDJD + '%')
                }
                if (type == 'faster_tribe_support') {
                    factorFTS = effect.factor
                    EffectsForDefender.push(' Zjednoczenie ' + factorFTS + '%')
                }
            })
            var finishedDefEffects = EffectsForDefender.join()
            var attFaith = (details.attFaith * 100).toFixed([0])
            var attModifier = (Math.round(details.attModifier * 100)).toFixed([0])
            var morale = (Math.round(details.morale * 100)).toFixed([0])
            var luck = ((details.luck - 1) * 100).toFixed([0])
            var defCharacterId = details.defCharacterId
            var defCharacterName = details.defCharacterName
            var defVillageId = details.defVillageId
            var defVillageName = details.defVillageName
            var defFaith = (details.defFaith * 100).toFixed([0])
            var defModifier = (Math.round(details.defModifier * 100)).toFixed([0])
            var wallBonus = (details.wallBonus * 100).toFixed([0])
            var night = details.night
            var loyaltyAfter = details.loyaltyAfter
            var loyaltyBefore = details.loyaltyBefore
            var wallAfter = details.wallAfter
            var wallBefore = details.wallBefore
            var officers = details.officers
            var leaderF = details.leader
            var resultString = ''
            var origin = ''
            var gamer = ''
            var nightB = ''
            var officersF = ''
            var loyaltyStart = ''
            var loyaltyFinish = ''
            var wallStart = ''
            var wallFinish = ''
            var dateNow = Date.now()
            var newToken = token.split('.').join('_')
            if (loyaltyBefore != null) {
                loyaltyStart = 'Lojalność przed atakiem: ' + Math.floor(loyaltyBefore) + ' '
            }
            if (loyaltyAfter != null) {
                loyaltyFinish = 'Lojalność po ataku: ' + Math.floor(loyaltyAfter) + ' '
            }
            if (wallBefore != null) {
                wallStart = 'Mury przed ataku: ' + wallBefore + ' '
            }
            if (wallAfter != null) {
                wallFinish = 'Mury po ataku: ' + wallAfter + ' '
            }
            if (officers == null && leaderF == 1.0) {
                officersF = 'Brak'
            } else if (officers == null && leaderF == 1.1) {
                officersF = ' Wielki Mistrz '
            }
            if (night == false) {
                nightB = 'Nie'
            } else {
                nightB = 'Tak'
            }
            if (result == 2) {
                resultString = ' [color=d96a19]Częściowy sukces[/color]'
            } else if (result == 1) {
                resultString = ' [color=0a8028]Sukces[/color]'
            } else if (result == 3) {
                resultString = ' [color=e21f1f]Porażka[/color]'
            }
            if (attCharacterName == null && attCharacterId == null) {
                gamer = 'Brak danych'
            } else {
                gamer = '[player=' + attCharacterId + ']' + attCharacterName + '[/player]'
            }
            if (attVillageName == null && attVillageId == null) {
                origin = 'Brak danych'
            } else {
                origin = '[village=' + attVillageId + ']' + attVillageName + '[/village]'
            }
            time = Math.floor((dateNow / 1000) - timecreated)

            alertText.push('[size=XL][b]Raport obronny: [report]' + newToken + '[/report][br]' + resultString + '[/b][/size][br][b][size=large] Czas wejścia ataku: ' + finalTime + '[/size][/b][br][size=medium][b] Wioska cel: [/b][village=' + defVillageId + ']' + defVillageName + '[/village][b] Gracz cel: [/b][player=' + defCharacterId + ']' + defCharacterName + '[/player][br]Modyfikator obrony: [b]' + defModifier + '[/b] Bonus za mury: [b]' + wallBonus + '[/b][br]Wiara: [b]' + defFaith + '[/b] Bonus nocny: [b]' + nightB + '[/b][br]Pozostałe bonusy: [b]' + finishedDefEffects + '[/b][br][b]Wioska pochodzenia: [/b]' + origin + '[b] Gracz atakujący: [/b]' + gamer + '[br]Modyfikator ataku: [b]' + attModifier + '[/b] Morale: [b]' + morale + '[/b][br]Wiara: [b]' + attFaith + '[/b] Szczęście: [b]' + luck + '[/b][br]Pozostałe bonusy: [b]' + finishedAttEffects + '[/b][br]Oficerowie: [b]' + officersF + '[/b][br]' + loyaltyStart + '' + loyaltyFinish + '[br]' + wallStart + '' + wallFinish + '[/size]')

            var message = alertText.join()
            if (time < 10800) {
                if (playerName == 'Hajduk Split' || playerName == 'halfsack' || playerName == 'Black Rider') {
                    socketService.emit(routeProvider.MESSAGE_REPLY, {
                        message_id: 14381,
                        message: message
                    })
                } else {
                    socketService.emit(routeProvider.MESSAGE_REPLY, {
                        message_id: 6982,
                        message: message
                    })
                }
                alertText = []
            }
        }
    }


    var sendInfoAttack = function sendInfoAttack(data) {
        var alertText = []
        var result = data.result
        var token = data.token
        var timecreated = data.time_created
        var time
        var finalTime = secondsToDaysHHMMSS(timecreated)
        var details = data.ReportAttack
        var attCharacterId = details.attCharacterId
        var attCharacterName = details.attCharacterName
        var attVillageId = details.attVillageId
        var attVillageName = details.attVillageName
        var attEffects = details.attEffects
        var defEffects = details.defEffects
        var attUnits = details.attUnits
        var noFake = attUnits.spear + attUnits.sword + attUnits.axe + attUnits.archer + attUnits.light_cavalry + attUnits.mounted_archer + attUnits.ram + attUnits.catapult + attUnits.heavy_cavalry + attUnits.trebuchet + attUnits.knight + attUnits.snob + attUnits.doppelsoldner
        if (noFake > 30) {
            var EffectsForAttacker = []
            var EffectsForDefender = []
            attEffects.forEach(function(effect) {
                var type = effect.type
                var factorICC = 0
                var minlevelBWL = 0
                var bonusMAF = 0
                var ratioRAL = 0
                var bedsEHB = 0
                var increasedByISD = 0
                var increasedByIML = 0
                var factorRSB = 0
                var factorFSI = 0
                var factorRDJA = 0
                var factorRDJD = 0
                var factorFTS = 0
                if (type == 'increased_carrying_capacity') {
                    factorICC = ((effect.factor - 1) * 100).toFixed([0])
                    EffectsForAttacker.push(' Wagony ' + factorICC + '%')
                }
                if (type == 'base_wall_levels') {
                    minlevelBWL = effect.min_level
                    EffectsForAttacker.push(' Żelazny mur ' + minlevelBWL + '')
                }
                if (type == 'modify_attack_factor') {
                    bonusMAF = effect.bonus * 100
                    EffectsForAttacker.push(' Mistrzostwo broni ' + bonusMAF + '%')
                }
                if (type == 'revive_attacker_losses') {
                    ratioRAL = effect.ratio * 100
                    EffectsForAttacker.push(' Doktor ' + ratioRAL + '%')
                }
                if (type == 'extra_hospital_beds') {
                    bedsEHB = effect.beds
                    EffectsForAttacker.push(' Klinika ' + bedsEHB + '')
                }
                if (type == 'increase_spy_defense') {
                    increasedByISD = effect.increased_by
                    EffectsForAttacker.push(' Agent wewnętrzny ' + increasedByISD + '%')
                }
                if (type == 'increase_member_limit') {
                    increasedByIML = effect.increased_by
                    EffectsForAttacker.push(' Siła w liczbach ' + increasedByIML + '')
                }
                if (type == 'recruit_speed_boost') {
                    factorRSB = effect.factor
                    EffectsForAttacker.push(' Intensywny trening ' + factorRSB + '%')
                }
                if (type == 'farm_speed_increase') {
                    factorFSI = effect.factor
                    EffectsForAttacker.push(' Drogi najazdów ' + factorFSI + '%')
                }
                if (type == 'resource_deposit_job_amount') {
                    factorRDJA = effect.factor
                    EffectsForAttacker.push(' Wagony(depozyt) ' + factorRDJA + '%')
                }
                if (type == 'resource_deposit_job_duration') {
                    factorRDJD = effect.factor
                    EffectsForAttacker.push(' Drogi najazdów(depozyt) ' + factorRDJD + '%')
                }
                if (type == 'faster_tribe_support') {
                    factorFTS = effect.factor
                    EffectsForAttacker.push(' Zjednoczenie ' + factorFTS + '%')
                }
            })
            var finishedAttEffects = EffectsForAttacker.join()
            defEffects.forEach(function(effect) {
                var type = effect.type
                var factorICC = 0
                var minlevelBWL = 0
                var bonusMAF = 0
                var ratioRAL = 0
                var bedsEHB = 0
                var increasedByISD = 0
                var increasedByIML = 0
                var factorRSB = 0
                var factorFSI = 0
                var factorRDJA = 0
                var factorRDJD = 0
                var factorFTS = 0
                if (type == 'increased_carrying_capacity') {
                    factorICC = ((effect.factor - 1) * 100).toFixed([0])
                    EffectsForDefender.push(' Wagony ' + factorICC + '%')
                }
                if (type == 'base_wall_levels') {
                    minlevelBWL = effect.min_level
                    EffectsForDefender.push(' Żelazny mur ' + minlevelBWL + '')
                }
                if (type == 'modify_attack_factor') {
                    bonusMAF = effect.bonus * 100
                    EffectsForDefender.push(' Mistrzostwo broni ' + bonusMAF + '%')
                }
                if (type == 'revive_attacker_losses') {
                    ratioRAL = effect.ratio * 100
                    EffectsForDefender.push(' Doktor ' + ratioRAL + '%')
                }
                if (type == 'extra_hospital_beds') {
                    bedsEHB = effect.beds
                    EffectsForDefender.push(' Klinika ' + bedsEHB + '')
                }
                if (type == 'increase_spy_defense') {
                    increasedByISD = effect.increased_by
                    EffectsForDefender.push(' Agent wewnętrzny ' + increasedByISD + '%')
                }
                if (type == 'increase_member_limit') {
                    increasedByIML = effect.increased_by
                    EffectsForDefender.push(' Siła w liczbach ' + increasedByIML + '')
                }
                if (type == 'recruit_speed_boost') {
                    factorRSB = effect.factor
                    EffectsForDefender.push(' Intensywny trening ' + factorRSB + '%')
                }
                if (type == 'farm_speed_increase') {
                    factorFSI = effect.factor
                    EffectsForDefender.push(' Drogi najazdów ' + factorFSI + '%')
                }
                if (type == 'resource_deposit_job_amount') {
                    factorRDJA = effect.factor
                    EffectsForDefender.push(' Wagony(depozyt) ' + factorRDJA + '%')
                }
                if (type == 'resource_deposit_job_duration') {
                    factorRDJD = effect.factor
                    EffectsForDefender.push(' Drogi najazdów(depozyt) ' + factorRDJD + '%')
                }
                if (type == 'faster_tribe_support') {
                    factorFTS = effect.factor
                    EffectsForDefender.push(' Zjednoczenie ' + factorFTS + '%')
                }
            })
            var finishedDefEffects = EffectsForDefender.join()
            var attFaith = (details.attFaith * 100).toFixed([0])
            var attModifier = (Math.round(details.attModifier * 100)).toFixed([0])
            var morale = (Math.round(details.morale * 100)).toFixed([0])
            var luck = ((details.luck - 1) * 100).toFixed([0])
            var defCharacterId = details.defCharacterId
            var defCharacterName = details.defCharacterName
            var defVillageId = details.defVillageId
            var defVillageName = details.defVillageName
            var defFaith = (details.defFaith * 100).toFixed([0])
            var defModifier = (Math.round(details.defModifier * 100)).toFixed([0])
            var wallBonus = (details.wallBonus * 100).toFixed([0])
            var night = details.night
            var loyaltyAfter = details.loyaltyAfter
            var loyaltyBefore = details.loyaltyBefore
            var wallAfter = details.wallAfter
            var wallBefore = details.wallBefore
            var officers = details.officers
            var resultString = ''
            var origin = ''
            var gamer = ''
            var nightB = ''
            var loyaltyStart = ''
            var loyaltyFinish = ''
            var wallStart = ''
            var wallFinish = ''
            var officersF = []
            var officersD
            var dateNow = Date.now()
            var newToken = token.split('.').join('_')
            if (loyaltyBefore != null) {
                loyaltyStart = 'Lojalność przed atakiem: ' + Math.floor(loyaltyBefore) + ' '
            }
            if (loyaltyAfter != null) {
                loyaltyFinish = 'Lojalność po ataku: ' + Math.floor(loyaltyAfter) + ' '
            }
            if (wallBefore != null) {
                wallStart = 'Mury przed ataku: ' + wallBefore + ' '
            }
            if (wallAfter != null) {
                wallFinish = 'Mury po ataku: ' + wallAfter + ' '
            }
            if (officers == null) {
                officersF.push('Brak')
            } else {
                var bastard = details.officers.bastard
                var leader = details.officers.leader
                var medic = details.officers.medic
                var scout = details.officers.scout
                var loot = details.officers.loot_master
                var supporter = details.officers.supporter
                if (bastard == false && leader == false && medic == false && loot == false && scout == false && supporter == false) {
                    officersF.push('Brak')
                } else {
                    if (bastard == true) {
                        officersF.push(' Oszust ')
                    } else {
                        officersF.push('')
                    }
                    if (leader == true) {
                        officersF.push(' Wielki Mistrz ')
                    } else {
                        officersF.push('')
                    }
                    if (medic == true) {
                        officersF.push(' Medyk ')
                    } else {
                        officersF.push('')
                    }
                    if (scout == true) {
                        officersF.push(' Łowczy ')
                    } else {
                        officersF.push('')
                    }
                    if (loot == true) {
                        officersF.push(' Mistrz Łupu ')
                    } else {
                        officersF.push('')
                    }
                    if (supporter == true) {
                        officersF.push(' Taktyk ')
                    } else {
                        officersF.push('')
                    }
                }
            }
            if (night == false) {
                nightB = 'Nie'
            } else {
                nightB = 'Tak'
            }
            if (result == 2) {
                resultString = ' [color=d96a19]Częściowy sukces[/color]'
            } else if (result == 1) {
                resultString = ' [color=0a8028]Sukces[/color]'
            } else if (result == 3) {
                resultString = ' [color=e21f1f]Porażka[/color]'
            }
            if (attCharacterName == null && attCharacterId == null) {
                gamer = 'Brak danych'
            } else {
                gamer = '[player=' + attCharacterId + ']' + attCharacterName + '[/player]'
            }
            if (attVillageName == null && attVillageId == null) {
                origin = 'Brak danych'
            } else {
                origin = '[village=' + attVillageId + ']' + attVillageName + '[/village]'
            }
            time = Math.floor((dateNow / 1000) - timecreated)
            officersD = officersF.join()

            if (defCharacterName != null) {
                alertText.push('[size=XL][b]Raport z ataku: [report]' + newToken + '[/report][br]' + resultString + '[/b][/size][br][b][size=large] Czas wejścia ataku: ' + finalTime + '[/size][/b][br][size=medium][b] Wioska cel: [/b][village=' + defVillageId + ']' + defVillageName + '[/village][b] Gracz cel: [/b][player=' + defCharacterId + ']' + defCharacterName + '[/player][br]Modyfikator obrony: [b]' + defModifier + '[/b] Bonus za mury: [b]' + wallBonus + '[/b][br]Wiara: [b]' + defFaith + '[/b] Bonus nocny: [b]' + nightB + '[/b][br]Pozostałe bonusy: [b]' + finishedDefEffects + '[/b][br][b]Wioska pochodzenia: [/b]' + origin + '[b] Gracz atakujący: [/b]' + gamer + '[br]Modyfikator ataku: [b]' + attModifier + '[/b] Morale: [b]' + morale + '[/b][br]Wiara: [b]' + attFaith + '[/b] Szczęście: [b]' + luck + '[/b][br]Pozostałe bonusy: [b]' + finishedAttEffects + '[/b][br]Oficerowie: [b]' + officersD + '[/b][br]' + loyaltyStart + '' + loyaltyFinish + '[br]' + wallStart + '' + wallFinish + '[/size]')

                var message = alertText.join()
                if (time < 10800) {
                    if (playerName == 'Hajduk Split' || playerName == 'halfsack' || playerName == 'Black Rider') {
                        socketService.emit(routeProvider.MESSAGE_REPLY, {
                            message_id: 14380,
                            message: message
                        })
                    } else {
                        socketService.emit(routeProvider.MESSAGE_REPLY, {
                            message_id: 6983,
                            message: message
                        })
                    }
                    alertText = []
                }
            }
        }
    }

    var reportSender = {}
    reportSender.init = function() {
        initialized = true
    }
    reportSender.start = function() {
        eventQueue.trigger(eventTypeProvider.REPORT_SENDER_STARTED)
        running = true
        checkNewReports()
    }
    reportSender.stop = function() {
        eventQueue.trigger(eventTypeProvider.REPORT_SENDER_STOPPED)
        running = false
    }
    reportSender.isRunning = function() {
        return running
    }
    reportSender.isInitialized = function() {
        return initialized
    }
    return reportSender
})
define('two/reportSender/events', [], function () {
    angular.extend(eventTypeProvider, {
        REPORT_SENDER_STARTED: 'report_sender_started',
        REPORT_SENDER_STOPPED: 'report_sender_stopped'
    })
})

define('two/reportSender/ui', [
    'two/ui',
    'two/reportSender',
    'two/utils',
    'queues/EventQueue'
], function (
    interfaceOverflow,
    reportSender,
    utils,
    eventQueue
) {
    let $button

    const init = function () {
        interfaceOverflow.addDivisor(71)
        $button = interfaceOverflow.addMenuButton('Goniec', 70, $filter('i18n')('description', $rootScope.loc.ale, 'report_sender'))

        $button.addEventListener('click', function () {
            if (reportSender.isRunning()) {
                reportSender.stop()
                utils.notif('success', $filter('i18n')('deactivated', $rootScope.loc.ale, 'report_sender'))
            } else {
                reportSender.start()
                utils.notif('success', $filter('i18n')('activated', $rootScope.loc.ale, 'report_sender'))
            }
        })

        eventQueue.register(eventTypeProvider.REPORT_SENDER_STARTED, function () {
            $button.classList.remove('btn-orange')
            $button.classList.add('btn-red')
        })

        eventQueue.register(eventTypeProvider.REPORT_SENDER_STOPPED, function () {
            $button.classList.remove('btn-red')
            $button.classList.add('btn-orange')
        })

        if (reportSender.isRunning()) {
            eventQueue.trigger(eventTypeProvider.REPORT_SENDER_STARTED)
        }

        return opener
    }

    return init
})
require([
    'two/ready',
    'two/reportSender',
    'two/reportSender/ui',
    'Lockr',
    'queues/EventQueue',
    'two/reportSender/events',
], function(
    ready,
    reportSender,
    reportSenderInterface,
    Lockr,
    eventQueue
) {
    const STORAGE_KEYS = {
        ACTIVE: 'report_sender_active'
    }
	
    if (reportSender.isInitialized()) {
        return false
    }
    ready(function() {
        reportSender.init()
        reportSenderInterface()

        ready(function() {
            if (Lockr.get(STORAGE_KEYS.ACTIVE, false, true)) {
                reportSender.start()
            }

            eventQueue.register(eventTypeProvider.REPORT_SENDER_STARTED, function() {
                Lockr.set(STORAGE_KEYS.ACTIVE, true)
            })

            eventQueue.register(eventTypeProvider.REPORT_SENDER_STOPPED, function() {
                Lockr.set(STORAGE_KEYS.ACTIVE, false)
            })
        }, ['initial_village'])
    })
})
define('two/spyMaster', [
    'two/Settings',
    'two/spyMaster/settings',
    'two/spyMaster/settings/map',
    'two/spyMaster/settings/updates',
    'two/spyMaster/types/building',
    'two/spyMaster/types/unit',
    'two/spyMaster/types/dummies',
    'two/spyMaster/types/replacement',
    'two/ready',
    'queues/EventQueue'
], function(
    Settings,
    SETTINGS,
    SETTINGS_MAP,
    UPDATES,
    C_BUILDING,
    C_UNIT,
    C_DUMMIES,
    C_REPLACEMENT,
    ready,
    eventQueue
) {
    let initialized = false
    let running = false
    let settings
    let spyMasterSettings
    const STORAGE_KEYS = {
        SETTINGS: 'spy_master_settings'
    }
    const COUNTERMEASURES_BUILDING = {
        [C_BUILDING.HEADQUARTER]: 'headquarter',
        [C_BUILDING.WAREHOUSE]: 'warehouse',
        [C_BUILDING.FARM]: 'farm',
        [C_BUILDING.RALLY_POINT]: 'rally_point',
        [C_BUILDING.STATUE]: 'statue',
        [C_BUILDING.WALL]: 'wall',
        [C_BUILDING.TAVERN]: 'tavern',
        [C_BUILDING.BARRACKS]: 'barracks',
        [C_BUILDING.PRECEPTORY]: 'preceptory',
        [C_BUILDING.HOSPITAL]: 'hospital',
        [C_BUILDING.CLAY_PIT]: 'clay_pit',
        [C_BUILDING.IRON_MINE]: 'iron_mine',
        [C_BUILDING.TIMBER_CAMP]: 'timber_camp',
        [C_BUILDING.CHAPEL]: 'chapel',
        [C_BUILDING.CHURCH]: 'church',
        [C_BUILDING.MARKET]: 'market',
        [C_BUILDING.ACADEMY]: 'academy'
    }
    const COUNTERMEASURES_REPLACEMENT = {
        [C_REPLACEMENT.SPEAR]: 'spear',
        [C_REPLACEMENT.SWORD]: 'sword',
        [C_REPLACEMENT.AXE]: 'axe',
        [C_REPLACEMENT.ARCHER]: 'archer',
        [C_REPLACEMENT.LIGHT_CAVALRY]: 'light_cavalry',
        [C_REPLACEMENT.MOUNTED_ARCHER]: 'mounted_archer',
        [C_REPLACEMENT.HEAVT_CAVALRY]: 'heavy_cavalry',
        [C_REPLACEMENT.RAM]: 'ram',
        [C_REPLACEMENT.CATAPULT]: 'catapult',
        [C_REPLACEMENT.TREBUCHET]: 'trebuchet',
        [C_REPLACEMENT.DOPPELSOLDNER]: 'doppelsoldner',
        [C_REPLACEMENT.SNOB]: 'snob',
        [C_REPLACEMENT.KNIGHT]: 'knight'
    }
    const COUNTERMEASURES_DUMMIES = {
        [C_DUMMIES.SPEAR]: 'spear',
        [C_DUMMIES.SWORD]: 'sword',
        [C_DUMMIES.AXE]: 'axe',
        [C_DUMMIES.ARCHER]: 'archer',
        [C_DUMMIES.LIGHT_CAVALRY]: 'light_cavalry',
        [C_DUMMIES.MOUNTED_ARCHER]: 'mounted_archer',
        [C_DUMMIES.HEAVT_CAVALRY]: 'heavy_cavalry',
        [C_DUMMIES.RAM]: 'ram',
        [C_DUMMIES.CATAPULT]: 'catapult',
        [C_DUMMIES.TREBUCHET]: 'trebuchet',
        [C_DUMMIES.DOPPELSOLDNER]: 'doppelsoldner',
        [C_DUMMIES.SNOB]: 'snob',
        [C_DUMMIES.KNIGHT]: 'knight'
    }
    const COUNTERMEASURES_UNIT = {
        [C_UNIT.SPEAR]: 'spear',
        [C_UNIT.SWORD]: 'sword',
        [C_UNIT.AXE]: 'axe',
        [C_UNIT.ARCHER]: 'archer',
        [C_UNIT.LIGHT_CAVALRY]: 'light_cavalry',
        [C_UNIT.MOUNTED_ARCHER]: 'mounted_archer',
        [C_UNIT.HEAVT_CAVALRY]: 'heavy_cavalry',
        [C_UNIT.RAM]: 'ram',
        [C_UNIT.CATAPULT]: 'catapult',
        [C_UNIT.TREBUCHET]: 'trebuchet',
        [C_UNIT.DOPPELSOLDNER]: 'doppelsoldner',
        [C_UNIT.SNOB]: 'snob',
        [C_UNIT.KNIGHT]: 'knight'
    }
    console.log(COUNTERMEASURES_UNIT, COUNTERMEASURES_REPLACEMENT, COUNTERMEASURES_BUILDING, COUNTERMEASURES_DUMMIES)
    const spyMaster = {}
    spyMaster.init = function() {
        initialized = true
        settings = new Settings({
            settingsMap: SETTINGS_MAP,
            storageKey: STORAGE_KEYS.SETTINGS
        })
        spyMasterSettings = settings.getAll()
        console.log('all settings', spyMasterSettings)
    }
    spyMaster.start = function() {
        running = true
        eventQueue.trigger(eventTypeProvider.SPY_MASTER_START)
    }
    spyMaster.stop = function() {
        running = false
        eventQueue.trigger(eventTypeProvider.SPY_MASTER_STOP)
    }
    spyMaster.getSettings = function() {
        return settings
    }
    spyMaster.isInitialized = function() {
        return initialized
    }
    spyMaster.isRunning = function() {
        return running
    }
    return spyMaster
})
define('two/spyMaster/events', [], function () {
    angular.extend(eventTypeProvider, {
        SPY_MASTER_START: 'spy_master_start',
        SPY_MASTER_STOP: 'spy_master_stop'
    })
})

define('two/spyMaster/ui', [
    'two/ui',
    'two/spyMaster',
    'two/spyMaster/settings',
    'two/spyMaster/settings/map',
    'two/spyMaster/types/building',
    'two/spyMaster/types/unit',
    'two/spyMaster/types/dummies',
    'two/spyMaster/types/replacement',
    'two/Settings',
    'two/EventScope',
    'two/utils'
], function(
    interfaceOverflow,
    spyMaster,
    SETTINGS,
    SETTINGS_MAP,
    C_BUILDING,
    C_UNIT,
    C_DUMMIES,
    C_REPLACEMENT,
    Settings,
    EventScope,
    utils
) {
    let $scope
    let settings
    let $button
    const TAB_TYPES = {
        SPY: 'spy',
        COUNTERMEASURES: 'countermeasures',
        LOGS: 'logs'
    }
    const selectTab = function(tabType) {
        $scope.selectedTab = tabType
    }
    const saveSettings = function() {
        settings.setAll(settings.decode($scope.settings))
        utils.notif('success', 'Settings saved')
    }
    const switchState = function() {
        if (spyMaster.isRunning()) {
            spyMaster.stop()
        } else {
            spyMaster.start()
        }
    }
    const eventHandlers = {
        start: function() {
            $scope.running = true
            $button.classList.remove('btn-orange')
            $button.classList.add('btn-red')
            utils.notif('success', $filter('i18n')('general.started', $rootScope.loc.ale, 'spy_master'))
        },
        stop: function() {
            $scope.running = false
            $button.classList.remove('btn-red')
            $button.classList.add('btn-orange')
            utils.notif('success', $filter('i18n')('general.stopped', $rootScope.loc.ale, 'spy_master'))
        }
    }
    const init = function() {
        settings = spyMaster.getSettings()
        $button = interfaceOverflow.addMenuButton3('Zwiadowca', 10)
        $button.addEventListener('click', buildWindow)
        interfaceOverflow.addTemplate('twoverflow_spy_master_window', `<div id=\"two-spy-master\" class=\"win-content two-window\"><header class=\"win-head\"><h2>Zwiadowca</h2><ul class=\"list-btn\"><li><a href=\"#\" class=\"size-34x34 btn-red icon-26x26-close\" ng-click=\"closeWindow()\"></a></ul></header><div class=\"win-main\" scrollbar=\"\"><div class=\"tabs tabs-bg\"><div class=\"tabs-three-col\"><div class=\"tab\" ng-click=\"selectTab(TAB_TYPES.SPY)\" ng-class=\"{'tab-active': selectedTab == TAB_TYPES.SPY}\"><div class=\"tab-inner\"><div ng-class=\"{'box-border-light': selectedTab === TAB_TYPES.SPY}\"><a href=\"#\" ng-class=\"{'btn-icon btn-orange': selectedTab !== TAB_TYPES.SPY}\">{{ TAB_TYPES.SPY | i18n:loc.ale:'spy_master' }}</a></div></div></div><div class=\"tab\" ng-click=\"selectTab(TAB_TYPES.COUNTERMEASURES)\" ng-class=\"{'tab-active': selectedTab == TAB_TYPES.COUNTERMEASURES}\"><div class=\"tab-inner\"><div ng-class=\"{'box-border-light': selectedTab === TAB_TYPES.COUNTERMEASURES}\"><a href=\"#\" ng-class=\"{'btn-icon btn-orange': selectedTab !== TAB_TYPES.COUNTERMEASURES}\">{{ TAB_TYPES.COUNTERMEASURES | i18n:loc.ale:'spy_master' }}</a></div></div></div><div class=\"tab\" ng-click=\"selectTab(TAB_TYPES.LOGS)\" ng-class=\"{'tab-active': selectedTab == TAB_TYPES.LOGS}\"><div class=\"tab-inner\"><div ng-class=\"{'box-border-light': selectedTab === TAB_TYPES.LOGS}\"><a href=\"#\" ng-class=\"{'btn-icon btn-orange': selectedTab !== TAB_TYPES.LOGS}\">{{ TAB_TYPES.LOGS | i18n:loc.ale:'spy_master' }}</a></div></div></div></div></div><div class=\"box-paper footer\"><div class=\"scroll-wrap\"><div class=\"settings\" ng-show=\"selectedTab === TAB_TYPES.SPY\"><h5 class=\"twx-section\">{{ 'spyU' | i18n:loc.ale:'spy_master' }}</h5><form class=\"addForm\"><table class=\"tbl-border-light tbl-striped\"><col width=\"20%\"><col><col width=\"18%\"><tr><td class=\"cell-bottom\"><input class=\"fit textfield-border text-center\" ng-model=\"settings[SETTINGS.SPY_UNITS]\"><td class=\"item-name\">{{ 'spyU.text' | i18n:loc.ale:'spy_master' }}<td class=\"item-send\"><span class=\"btn-green btn-border\" tooltip=\"\" tooltip-content=\"{{ 'sendingU' | i18n:loc.ale:'spy_master' }}\">{{ 'send' | i18n:loc.ale:'spy_master' }}</span></table></form><h5 class=\"twx-section\">{{ 'spyB' | i18n:loc.ale:'spy_master' }}</h5><form class=\"addForm\"><table class=\"tbl-border-light tbl-striped\"><col width=\"20%\"><col><col width=\"18%\"><tr><td class=\"cell-bottom\"><input class=\"fit textfield-border text-center\" ng-model=\"settings[SETTINGS.SPY_BUILDINGS]\"><td class=\"item-name\">{{ 'spyB.text' | i18n:loc.ale:'spy_master' }}<td class=\"item-send\"><span class=\"btn-green btn-border\" tooltip=\"\" tooltip-content=\"{{ 'sendingB' | i18n:loc.ale:'spy_master' }}\">{{ 'send' | i18n:loc.ale:'spy_master' }}</span></table></form><h5 class=\"twx-section\">{{ 'spyA' | i18n:loc.ale:'spy_master' }}</h5><form class=\"addForm\"><table class=\"tbl-border-light tbl-striped\"><col width=\"20%\"><col><col width=\"18%\"><tr><td class=\"cell-bottom\"><input class=\"fit textfield-border text-center\" ng-model=\"settings[SETTINGS.SPY_ALL]\"><td class=\"item-name\">{{ 'spyA.text' | i18n:loc.ale:'spy_master' }}<td class=\"item-send\"><span class=\"btn-green btn-border\" tooltip=\"\" tooltip-content=\"{{ 'sendingA' | i18n:loc.ale:'spy_master' }}\">{{ 'send' | i18n:loc.ale:'spy_master' }}</span></table></form><h5 class=\"twx-section\">{{ 'sabotage' | i18n:loc.ale:'spy_master' }}</h5><form class=\"addForm\"><table class=\"tbl-border-light tbl-striped\"><col width=\"20%\"><col><col width=\"18%\"><tr><td class=\"cell-bottom\"><input class=\"fit textfield-border text-center\" ng-model=\"settings[SETTINGS.SABOTAGE]\"><td class=\"item-name\">{{ 'sabotage.text' | i18n:loc.ale:'spy_master' }}<td class=\"item-send\"><span class=\"btn-green btn-border\" tooltip=\"\" tooltip-content=\"{{ 'sendingS' | i18n:loc.ale:'spy_master' }}\">{{ 'sabote' | i18n:loc.ale:'spy_master' }}</span></table></form><h5 class=\"twx-section\">{{ 'spyP' | i18n:loc.ale:'spy_master' }}</h5><form class=\"addForm\"><table class=\"tbl-border-light tbl-striped\"><col width=\"20%\"><col><col width=\"18%\"><tr><td class=\"cell-bottom\"><input class=\"fit textfield-border text-center\" ng-model=\"settings[SETTINGS.SPY_PLAYER]\"><td class=\"item-name\">{{ 'spyP.text' | i18n:loc.ale:'spy_master' }}<td class=\"item-send\"><span class=\"btn-green btn-border\" tooltip=\"\" tooltip-content=\"{{ 'sendingP' | i18n:loc.ale:'spy_master' }}\">{{ 'send' | i18n:loc.ale:'spy_master' }}</span></table></form></div><div class=\"settings\" ng-show=\"selectedTab === TAB_TYPES.COUNTERMEASURES\"><h5 class=\"twx-section\">{{ 'camouflage' | i18n:loc.ale:'spy_master' }}</h5><form class=\"addForm\"><table class=\"tbl-border-light tbl-striped\"><col width=\"25%\"><col width=\"17%\"><col><col width=\"18%\"><tr><td><div select=\"\" list=\"building\" selected=\"settings[SETTINGS.BUILDING]\" drop-down=\"true\"></div><td class=\"cell-bottom\"><input class=\"fit textfield-border text-center\" ng-model=\"settings[SETTINGS.BUILDING_LEVEL]\"><td class=\"item-name\">{{ 'camouflage.text' | i18n:loc.ale:'spy_master' }}<td class=\"item-camouflage\"><span class=\"btn-green btn-border camouflage\" tooltip=\"\" tooltip-content=\"{{ 'camouflage.tip' | i18n:loc.ale:'spy_master' }}\">{{ 'camouflage.btn' | i18n:loc.ale:'spy_master' }}</span></table></form><h5 class=\"twx-section\">{{ 'switch' | i18n:loc.ale:'spy_master' }}</h5><form class=\"addForm\"><table class=\"tbl-border-light tbl-striped\"><col width=\"20%\"><col width=\"20%\"><col><col width=\"18%\"><tr><td><div select=\"\" list=\"unit\" selected=\"settings[SETTINGS.UNIT]\" drop-down=\"true\"></div><td><div select=\"\" list=\"replacement\" selected=\"settings[SETTINGS.REPLACEMENT]\" drop-down=\"true\"></div><td class=\"item-name\">{{ 'switch.text' | i18n:loc.ale:'spy_master' }}<td class=\"item-switch\"><span class=\"btn-green btn-border switchWeapon\" tooltip=\"\" tooltip-content=\"{{ 'switch.tip' | i18n:loc.ale:'spy_master' }}\">{{ 'switch.btn' | i18n:loc.ale:'spy_master' }}</span></table></form><h5 class=\"twx-section\">{{ 'dummies' | i18n:loc.ale:'spy_master' }}</h5><form class=\"addForm\"><table class=\"tbl-border-light tbl-striped\"><col width=\"20%\"><col><col width=\"18%\"><tr><td><div select=\"\" list=\"dummies\" selected=\"settings[SETTINGS.DUMMIES]\" drop-down=\"true\"></div><td class=\"item-name\">{{ 'dummies.text' | i18n:loc.ale:'spy_master' }}<td class=\"item-dummies\"><span class=\"btn-green btn-border dummies\" tooltip=\"\" tooltip-content=\"{{ 'dummies.tip' | i18n:loc.ale:'spy_master' }}\">{{ 'dummies.btn' | i18n:loc.ale:'spy_master' }}</span></table></form><h5 class=\"twx-section\">{{ 'exchange' | i18n:loc.ale:'spy_master' }}</h5><form class=\"addForm\"><table class=\"tbl-border-light tbl-striped\"><col><col width=\"18%\"><tr><td class=\"item-name\">{{ 'exchange.text' | i18n:loc.ale:'spy_master' }}<td class=\"item-exchange\"><span class=\"btn-green btn-border exchange\" tooltip=\"\" tooltip-content=\"{{ 'exchange.tip' | i18n:loc.ale:'spy_master' }}\">{{ 'exchange.btn' | i18n:loc.ale:'spy_master' }}</span></table></form></div><div class=\"logs rich-text\" ng-show=\"selectedTab === TAB_TYPES.LOGS\"><table class=\"tbl-border-light tbl-striped header-center\"><col width=\"25%\"><col width=\"25%\"><col width=\"15%\"><col><col width=\"25%\"><thead><tr><th>{{ 'origin' | i18n:loc.ale:'spy_master' }}<th>{{ 'target' | i18n:loc.ale:'spy_master' }}<th>{{ 'type' | i18n:loc.ale:'spy_master' }}<th>{{ 'amount' | i18n:loc.ale:'spy_master' }}<th>{{ 'date' | i18n:loc.ale:'spy_master' }}<tbody class=\"spyLog\"><tr class=\"noSpies\"><td colspan=\"5\">{{ 'logs.noMissions' | i18n:loc.ale:'spy_master' }}</table></div></div></div></div><footer class=\"win-foot\"><ul class=\"list-btn list-center\"><li ng-show=\"selectedTab === TAB_TYPES.SPY\"><a href=\"#\" class=\"btn-border btn-orange\" ng-click=\"clearS()\">{{ 'clear' | i18n:loc.ale:'spy_master' }}</a><li ng-show=\"selectedTab === TAB_TYPES.COUNTERMEASURES\"><a href=\"#\" class=\"btn-border btn-orange\" ng-click=\"clearC()\">{{ 'clear' | i18n:loc.ale:'spy_master' }}</a><li ng-show=\"selectedTab === TAB_TYPES.LOGS\"><a href=\"#\" class=\"btn-border btn-orange\" ng-click=\"clearL()\">{{ 'logs.clear' | i18n:loc.ale:'spy_master' }}</a></ul></footer></div>`)
        interfaceOverflow.addStyle('#two-spy-master div[select]{float:right}#two-spy-master div[select] .select-handler{line-height:28px}#two-spy-master .range-container{width:250px}#two-spy-master .textfield-border{width:219px;height:34px;margin-bottom:2px;padding-top:2px}#two-spy-master .textfield-border.fit{width:100%}#two-spy-master .addForm input{width:100%}#two-spy-master .addForm td{text-align:center}#two-spy-master .addForm span{height:26px;line-height:26px;padding:0 10px}#two-spy-master .spyLog td{text-align:center}#two-spy-master .spyLog .origin:hover{color:#fff;text-shadow:0 1px 0 #000}#two-spy-master .spyLog .target:hover{color:#fff;text-shadow:0 1px 0 #000}')
    }
    const buildWindow = function() {
        $scope = $rootScope.$new()
        $scope.SETTINGS = SETTINGS
        $scope.TAB_TYPES = TAB_TYPES
        $scope.running = spyMaster.isRunning()
        $scope.selectedTab = TAB_TYPES.SPY
        $scope.settingsMap = SETTINGS_MAP
        $scope.building = Settings.encodeList(C_BUILDING, {
            textObject: 'spy_master',
            disabled: true
        })
        $scope.unit = Settings.encodeList(C_UNIT, {
            textObject: 'spy_master',
            disabled: true
        })
        $scope.dummies = Settings.encodeList(C_DUMMIES, {
            textObject: 'spy_master',
            disabled: true
        })
        $scope.replacement = Settings.encodeList(C_REPLACEMENT, {
            textObject: 'spy_master',
            disabled: true
        })
        settings.injectScope($scope)
        $scope.selectTab = selectTab
        $scope.saveSettings = saveSettings
        $scope.switchState = switchState
        let eventScope = new EventScope('twoverflow_spy_master_window', function onDestroy() {
            console.log('spyMaster window closed')
        })
        eventScope.register(eventTypeProvider.SPY_MASTER_START, eventHandlers.start)
        eventScope.register(eventTypeProvider.SPY_MASTER_STOP, eventHandlers.stop)
        windowManagerService.getScreenWithInjectedScope('!twoverflow_spy_master_window', $scope)
    }
    return init
})
define('two/spyMaster/settings', [], function () {
    return {
        SPY_UNITS: 'spy_units',
        SPY_BUILDINGS: 'spy_buildings',
        SPY_ALL: 'spy_all',
        SABOTAGE: 'sabotage',
        SPY_PLAYER: 'spy_player',
        BUILDING: 'building',
        BUILDING_LEVEL: 'building_level',
        REPLACEMENT: 'replacement',
        UNIT: 'unit',
        DUMMIES: 'dummies'
        
    }
})

define('two/spyMaster/settings/updates', function () {
    return {
    }
})

define('two/spyMaster/settings/map', [
    'two/spyMaster/settings'
], function (
    SETTINGS
) {
    return {
        [SETTINGS.BUILDING]: {
            default: false,
            disabledOption: true,
            inputType: 'select'
        },
        [SETTINGS.REPLACEMENT]: {
            default: false,
            disabledOption: true,
            inputType: 'select'
        },
        [SETTINGS.UNIT]: {
            default: false,
            disabledOption: true,
            inputType: 'select'
        },
        [SETTINGS.DUMMIES]: {
            default: false,
            disabledOption: true,
            inputType: 'select'
        }
    }
})

define('two/spyMaster/types/building', [], function () {
    return {
        HEADQUARTER: 'headquarter',
        WAREHOUSE: 'warehouse',
        FARM: 'farm',
        RALLY_POINT: 'rally_point',
        STATUE: 'statue',
        WALL: 'wall',
        TAVERN: 'tavern',
        BARRACKS: 'barracks',
        PRECEPTORY: 'preceptory',
        HOSPITAL: 'hospital',
        CLAY_PIT: 'clay_pit',
        IRON_MINE: 'iron_mine',
        TIMBER_CAMP: 'timber_camp',
        CHAPEL: 'chapel',
        CHURCH: 'church',
        MARKET: 'market',
        ACADEMY: 'academy'
    }
})

define('two/spyMaster/types/unit', [], function () {
    return {
        SPEAR: 'spear',
        SWORD: 'sword',
        AXE: 'axe',
        ARCHER: 'archer',
        LIGHT_CAVALRY: 'light_cavalry',
        MOUNTED_ARCHER: 'mounted_archer',
        HEAVY_CAVALRY: 'heavy_cavalry',
        RAM: 'ram',
        CATAPULT: 'catapult',
        TREBUCHET: 'trebuchet',
        DOPPELSOLDNER: 'doppelsoldner',
        SNOB: 'snob',
        KNIGHT: 'knight'
    }
})

define('two/spyMaster/types/dummies', [], function () {
    return {
        SPEAR: 'spear',
        SWORD: 'sword',
        AXE: 'axe',
        ARCHER: 'archer',
        LIGHT_CAVALRY: 'light_cavalry',
        MOUNTED_ARCHER: 'mounted_archer',
        HEAVY_CAVALRY: 'heavy_cavalry',
        RAM: 'ram',
        CATAPULT: 'catapult',
        TREBUCHET: 'trebuchet',
        DOPPELSOLDNER: 'doppelsoldner',
        SNOB: 'snob',
        KNIGHT: 'knight'
    }
})

define('two/spyMaster/types/replacement', [], function () {
    return {
        SPEAR: 'spear',
        SWORD: 'sword',
        AXE: 'axe',
        ARCHER: 'archer',
        LIGHT_CAVALRY: 'light_cavalry',
        MOUNTED_ARCHER: 'mounted_archer',
        HEAVY_CAVALRY: 'heavy_cavalry',
        RAM: 'ram',
        CATAPULT: 'catapult',
        TREBUCHET: 'trebuchet',
        DOPPELSOLDNER: 'doppelsoldner',
        SNOB: 'snob',
        KNIGHT: 'knight'
    }
})
require([
    'two/ready',
    'two/spyMaster',
    'two/spyMaster/ui',
    'two/spyMaster/events'
], function (
    ready,
    spyMaster,
    spyMasterInterface
) {
    if (spyMaster.isInitialized()) {
        return false
    }

    ready(function () {
        spyMaster.init()
        spyMasterInterface()
    }, ['map', 'world_config'])
})

define('two/spyRecruiter', [
    'two/utils',
    'queues/EventQueue'
], function (
    utils,
    eventQueue
) {
    let initialized = false
    let running = false

    var recruitSpy = function recruitSpy() {
        setInterval(function() {
            var player = modelDataService.getSelectedCharacter()
            var villages = player.getVillageList()
            villages.forEach(function(village) {
                var data = village.data
                var buildings = data.buildings
                var tavern = buildings.tavern
                var level = tavern.level
                var scoutingInfo = village.scoutingInfo
                var spies = scoutingInfo.spies
                var resources = village.getResources()
                var computed = resources.getComputed()
                var wood = computed.wood
                var clay = computed.clay
                var iron = computed.iron
                var villageWood = wood.currentStock
                var villageClay = clay.currentStock
                var villageIron = iron.currentStock
                var woodCost = [500, 1000, 2200, 7000, 12000]
                var clayCost = [500, 800, 2000, 6500, 10000]
                var ironCost = [500, 1200, 2400, 8000, 18000]
                if (level < 1) {
                    console.log('Brak tawerny w wiosce:' + village.getName())
                } else if (level >= 1 && level < 3) {
                    spies.forEach(function(spy) {
                        if (spy.id == 1 && spy.active != true && spy.recruitingInProgress != true && (villageWood >= woodCost[1] && villageClay >= clayCost[1] && villageIron >= ironCost[1])) {
                            socketService.emit(routeProvider.SCOUTING_RECRUIT, {
                                village_id: village.getId(),
                                slot: 1
                            })
                        }
                    })
                    console.log('Dodano do rekrutacji szpiega (slot 1) w wiosce:' + village.getName())
                } else if (level >= 3 && level < 6) {
                    spies.forEach(function(spy) {
                        if (spy.id == 1 && spy.active != true && spy.recruitingInProgress != true && (villageWood >= woodCost[1] && villageClay >= clayCost[1] && villageIron >= ironCost[1])) {
                            socketService.emit(routeProvider.SCOUTING_RECRUIT, {
                                village_id: village.getId(),
                                slot: 1
                            })
                            console.log('Dodano do rekrutacji szpiega (slot 1) w wiosce:' + village.getName())
                        } else if (spy.id == 2 && spy.active != true && spy.recruitingInProgress != true && (villageWood >= woodCost[2] && villageClay >= clayCost[2] && villageIron >= ironCost[2])) {
                            socketService.emit(routeProvider.SCOUTING_RECRUIT, {
                                village_id: village.getId(),
                                slot: 2
                            })
                            console.log('Dodano do rekrutacji szpiega (slot 2) w wiosce:' + village.getName())
                        }
                    })
                } else if (level >= 6 && level < 9) {
                    spies.forEach(function(spy) {
                        if ((spy.id == 3 && spy.recruitingInProgress == true) && (spy.id == 1 && spy.active != true)) {
                            socketService.emit(routeProvider.SCOUTING_CANCEL_RECRUIT, {
                                village_id: village.getId(),
                                slot: 3
                            })
                            socketService.emit(routeProvider.SCOUTING_RECRUIT, {
                                village_id: village.getId(),
                                slot: 1
                            })
                            console.log('Anulowano rekrutację szpiega (slot 3) w wiosce:' + village.getName())
                            console.log('Dodano do rekrutacji szpiega (slot 1) w wiosce:' + village.getName())
                        } else if (spy.id == 1 && spy.active != true && spy.recruitingInProgress != true && (villageWood >= woodCost[1] && villageClay >= clayCost[1] && villageIron >= ironCost[1])) {
                            socketService.emit(routeProvider.SCOUTING_RECRUIT, {
                                village_id: village.getId(),
                                slot: 1
                            })
                            console.log('Dodano do rekrutacji szpiega (slot 1) w wiosce:' + village.getName())
                        } else if (spy.id == 2 && spy.active != true && spy.recruitingInProgress != true && (villageWood >= woodCost[2] && villageClay >= clayCost[2] && villageIron >= ironCost[2])) {
                            socketService.emit(routeProvider.SCOUTING_RECRUIT, {
                                village_id: village.getId(),
                                slot: 2
                            })
                            console.log('Dodano do rekrutacji szpiega (slot 2) w wiosce:' + village.getName())
                        } else if (spy.id == 3 && spy.active != true && spy.recruitingInProgress != true && (villageWood >= woodCost[3] && villageClay >= clayCost[3] && villageIron >= ironCost[3])) {
                            socketService.emit(routeProvider.SCOUTING_RECRUIT, {
                                village_id: village.getId(),
                                slot: 3
                            })
                            console.log('Dodano do rekrutacji szpiega (slot 3) w wiosce:' + village.getName())
                        }
                    })
                } else if (level >= 9 && level < 12) {
                    spies.forEach(function(spy) {
                        if ((spy.id == 4 && spy.recruitingInProgress == true) && (spy.id == 1 && spy.active != true)) {
                            socketService.emit(routeProvider.SCOUTING_CANCEL_RECRUIT, {
                                village_id: village.getId(),
                                slot: 4
                            })
                            socketService.emit(routeProvider.SCOUTING_RECRUIT, {
                                village_id: village.getId(),
                                slot: 1
                            })
                            console.log('Anulowano rekrutację szpiega (slot 4) w wiosce:' + village.getName())
                            console.log('Dodano do rekrutacji szpiega (slot 1) w wiosce:' + village.getName())
                        } else if ((spy.id == 4 && spy.recruitingInProgress == true) && (spy.id == 2 && spy.active != true)) {
                            socketService.emit(routeProvider.SCOUTING_CANCEL_RECRUIT, {
                                village_id: village.getId(),
                                slot: 4
                            })
                            socketService.emit(routeProvider.SCOUTING_RECRUIT, {
                                village_id: village.getId(),
                                slot: 2
                            })
                            console.log('Anulowano rekrutację szpiega (slot 4) w wiosce:' + village.getName())
                            console.log('Dodano do rekrutacji szpiega (slot 2) w wiosce:' + village.getName())
                        } else if ((spy.id == 3 && spy.recruitingInProgress == true) && (spy.id == 1 && spy.active != true)) {
                            socketService.emit(routeProvider.SCOUTING_CANCEL_RECRUIT, {
                                village_id: village.getId(),
                                slot: 3
                            })
                            socketService.emit(routeProvider.SCOUTING_RECRUIT, {
                                village_id: village.getId(),
                                slot: 1
                            })
                            console.log('Anulowano rekrutację szpiega (slot 3) w wiosce:' + village.getName())
                            console.log('Dodano do rekrutacji szpiega (slot 1) w wiosce:' + village.getName())
                        } else if ((spy.id == 3 && spy.recruitingInProgress == true) && (spy.id == 2 && spy.active != true)) {
                            socketService.emit(routeProvider.SCOUTING_CANCEL_RECRUIT, {
                                village_id: village.getId(),
                                slot: 3
                            })
                            socketService.emit(routeProvider.SCOUTING_RECRUIT, {
                                village_id: village.getId(),
                                slot: 2
                            })
                            console.log('Anulowano rekrutację szpiega (slot 3) w wiosce:' + village.getName())
                            console.log('Dodano do rekrutacji szpiega (slot 2) w wiosce:' + village.getName())
                        } else if (spy.id == 1 && spy.active != true && spy.recruitingInProgress != true && (villageWood >= woodCost[1] && villageClay >= clayCost[1] && villageIron >= ironCost[1])) {
                            socketService.emit(routeProvider.SCOUTING_RECRUIT, {
                                village_id: village.getId(),
                                slot: 1
                            })
                            console.log('Dodano do rekrutacji szpiega (slot 1) w wiosce:' + village.getName())
                        } else if (spy.id == 2 && spy.active != true && spy.recruitingInProgress != true && (villageWood >= woodCost[2] && villageClay >= clayCost[2] && villageIron >= ironCost[2])) {
                            socketService.emit(routeProvider.SCOUTING_RECRUIT, {
                                village_id: village.getId(),
                                slot: 2
                            })
                            console.log('Dodano do rekrutacji szpiega (slot 2) w wiosce:' + village.getName())
                        } else if (spy.id == 3 && spy.active != true && spy.recruitingInProgress != true && (villageWood >= woodCost[3] && villageClay >= clayCost[3] && villageIron >= ironCost[3])) {
                            socketService.emit(routeProvider.SCOUTING_RECRUIT, {
                                village_id: village.getId(),
                                slot: 3
                            })
                            console.log('Dodano do rekrutacji szpiega (slot 3) w wiosce:' + village.getName())
                        } else if (spy.id == 4 && spy.active != true && spy.recruitingInProgress != true && (villageWood >= woodCost[4] && villageClay >= clayCost[4] && villageIron >= ironCost[4])) {
                            socketService.emit(routeProvider.SCOUTING_RECRUIT, {
                                village_id: village.getId(),
                                slot: 4
                            })
                            console.log('Dodano do rekrutacji szpiega (slot 4) w wiosce:' + village.getName())
                        }
                    })
                } else if (level >= 12) {
                    spies.forEach(function(spy) {
                        if ((spy.id == 5 && spy.recruitingInProgress == true) && (spy.id == 1 && spy.active != true)) {
                            socketService.emit(routeProvider.SCOUTING_CANCEL_RECRUIT, {
                                village_id: village.getId(),
                                slot: 5
                            })
                            socketService.emit(routeProvider.SCOUTING_RECRUIT, {
                                village_id: village.getId(),
                                slot: 1
                            })
                            console.log('Anulowano rekrutację szpiega (slot 5) w wiosce:' + village.getName())
                            console.log('Dodano do rekrutacji szpiega (slot 1) w wiosce:' + village.getName())
                        } else if ((spy.id == 5 && spy.recruitingInProgress == true) && (spy.id == 2 && spy.active != true)) {
                            socketService.emit(routeProvider.SCOUTING_CANCEL_RECRUIT, {
                                village_id: village.getId(),
                                slot: 5
                            })
                            socketService.emit(routeProvider.SCOUTING_RECRUIT, {
                                village_id: village.getId(),
                                slot: 2
                            })
                            console.log('Anulowano rekrutację szpiega (slot 5) w wiosce:' + village.getName())
                            console.log('Dodano do rekrutacji szpiega (slot 2) w wiosce:' + village.getName())
                        } else if ((spy.id == 4 && spy.recruitingInProgress == true) && (spy.id == 1 && spy.active != true)) {
                            socketService.emit(routeProvider.SCOUTING_CANCEL_RECRUIT, {
                                village_id: village.getId(),
                                slot: 4
                            })
                            socketService.emit(routeProvider.SCOUTING_RECRUIT, {
                                village_id: village.getId(),
                                slot: 1
                            })
                            console.log('Anulowano rekrutację szpiega (slot 4) w wiosce:' + village.getName())
                            console.log('Dodano do rekrutacji szpiega (slot 1) w wiosce:' + village.getName())
                        } else if ((spy.id == 3 && spy.recruitingInProgress == true) && (spy.id == 1 && spy.active != true)) {
                            socketService.emit(routeProvider.SCOUTING_CANCEL_RECRUIT, {
                                village_id: village.getId(),
                                slot: 3
                            })
                            socketService.emit(routeProvider.SCOUTING_RECRUIT, {
                                village_id: village.getId(),
                                slot: 1
                            })
                            console.log('Anulowano rekrutację szpiega (slot 3) w wiosce:' + village.getName())
                            console.log('Dodano do rekrutacji szpiega (slot 1) w wiosce:' + village.getName())
                        } else if ((spy.id == 4 && spy.recruitingInProgress == true) && (spy.id == 2 && spy.active != true)) {
                            socketService.emit(routeProvider.SCOUTING_CANCEL_RECRUIT, {
                                village_id: village.getId(),
                                slot: 4
                            })
                            socketService.emit(routeProvider.SCOUTING_RECRUIT, {
                                village_id: village.getId(),
                                slot: 2
                            })
                            console.log('Anulowano rekrutację szpiega (slot 4) w wiosce:' + village.getName())
                            console.log('Dodano do rekrutacji szpiega (slot 2) w wiosce:' + village.getName())
                        } else if ((spy.id == 5 && spy.recruitingInProgress == true) && (spy.id == 3 && spy.active != true)) {
                            socketService.emit(routeProvider.SCOUTING_CANCEL_RECRUIT, {
                                village_id: village.getId(),
                                slot: 5
                            })
                            socketService.emit(routeProvider.SCOUTING_RECRUIT, {
                                village_id: village.getId(),
                                slot: 3
                            })
                            console.log('Anulowano rekrutację szpiega (slot 5) w wiosce:' + village.getName())
                            console.log('Dodano do rekrutacji szpiega (slot 3) w wiosce:' + village.getName())
                        } else if ((spy.id == 3 && spy.recruitingInProgress == true) && (spy.id == 2 && spy.active != true)) {
                            socketService.emit(routeProvider.SCOUTING_CANCEL_RECRUIT, {
                                village_id: village.getId(),
                                slot: 3
                            })
                            socketService.emit(routeProvider.SCOUTING_RECRUIT, {
                                village_id: village.getId(),
                                slot: 2
                            })
                            console.log('Anulowano rekrutację szpiega (slot 3) w wiosce:' + village.getName())
                            console.log('Dodano do rekrutacji szpiega (slot 2) w wiosce:' + village.getName())
                        } else if ((spy.id == 4 && spy.recruitingInProgress == true) && (spy.id == 3 && spy.active != true)) {
                            socketService.emit(routeProvider.SCOUTING_CANCEL_RECRUIT, {
                                village_id: village.getId(),
                                slot: 4
                            })
                            socketService.emit(routeProvider.SCOUTING_RECRUIT, {
                                village_id: village.getId(),
                                slot: 3
                            })
                            console.log('Anulowano rekrutację szpiega (slot 4) w wiosce:' + village.getName())
                            console.log('Dodano do rekrutacji szpiega (slot 3) w wiosce:' + village.getName())
                        } else if ((spy.id == 5 && spy.recruitingInProgress == true) && (spy.id == 4 && spy.active != true)) {
                            socketService.emit(routeProvider.SCOUTING_CANCEL_RECRUIT, {
                                village_id: village.getId(),
                                slot: 5
                            })
                            socketService.emit(routeProvider.SCOUTING_RECRUIT, {
                                village_id: village.getId(),
                                slot: 4
                            })
                            console.log('Anulowano rekrutację szpiega (slot 5) w wiosce:' + village.getName())
                            console.log('Dodano do rekrutacji szpiega (slot 4) w wiosce:' + village.getName())
                        } else if (spy.id == 1 && spy.active != true && spy.recruitingInProgress != true && (villageWood >= woodCost[1] && villageClay >= clayCost[1] && villageIron >= ironCost[1])) {
                            socketService.emit(routeProvider.SCOUTING_RECRUIT, {
                                village_id: village.getId(),
                                slot: 1
                            })
                            console.log('Dodano do rekrutacji szpiega (slot 1) w wiosce:' + village.getName())
                        } else if (spy.id == 2 && spy.active != true && spy.recruitingInProgress != true && (villageWood >= woodCost[2] && villageClay >= clayCost[2] && villageIron >= ironCost[2])) {
                            socketService.emit(routeProvider.SCOUTING_RECRUIT, {
                                village_id: village.getId(),
                                slot: 2
                            })
                            console.log('Dodano do rekrutacji szpiega (slot 2) w wiosce:' + village.getName())
                        } else if (spy.id == 3 && spy.active != true && spy.recruitingInProgress != true && (villageWood >= woodCost[3] && villageClay >= clayCost[3] && villageIron >= ironCost[3])) {
                            socketService.emit(routeProvider.SCOUTING_RECRUIT, {
                                village_id: village.getId(),
                                slot: 3
                            })
                            console.log('Dodano do rekrutacji szpiega (slot 3) w wiosce:' + village.getName())
                        } else if (spy.id == 4 && spy.active != true && spy.recruitingInProgress != true && (villageWood >= woodCost[4] && villageClay >= clayCost[4] && villageIron >= ironCost[4])) {
                            socketService.emit(routeProvider.SCOUTING_RECRUIT, {
                                village_id: village.getId(),
                                slot: 4
                            })
                            console.log('Dodano do rekrutacji szpiega (slot 4) w wiosce:' + village.getName())
                        } else if (spy.id == 5 && spy.active != true && spy.recruitingInProgress != true && (villageWood >= woodCost[5] && villageClay >= clayCost[5] && villageIron >= ironCost[5])) {
                            socketService.emit(routeProvider.SCOUTING_RECRUIT, {
                                village_id: village.getId(),
                                slot: 5
                            })
                            console.log('Dodano do rekrutacji szpiega (slot 5) w wiosce:' + village.getName())
                        }
                    })
                }
            })
            utils.notif('success',  $filter('i18n')('revived', $rootScope.loc.ale, 'spy_recruiter'))
        }, 120000)
    }
	
    let spyRecruiter = {}
    spyRecruiter.init = function() {
        initialized = true
    }
    spyRecruiter.start = function() {
        eventQueue.trigger(eventTypeProvider.SPY_RECRUITER_STARTED)
        running = true
        recruitSpy()
    }
    spyRecruiter.stop = function() {
        eventQueue.trigger(eventTypeProvider.SPY_RECRUITER_STOPPED)
        running = false
    }
    spyRecruiter.isRunning = function() {
        return running
    }
    spyRecruiter.isInitialized = function() {
        return initialized
    }
    return spyRecruiter
})
define('two/spyRecruiter/events', [], function () {
    angular.extend(eventTypeProvider, {
        SPY_RECRUITER_STARTED: 'spy_recruiter_started',
        SPY_RECRUITER_STOPPED: 'spy_recruiter_stopped'
    })
})

define('two/spyRecruiter/ui', [
    'two/ui',
    'two/spyRecruiter',
    'two/utils',
    'queues/EventQueue'
], function (
    interfaceOverflow,
    spyRecruiter,
    utils,
    eventQueue
) {
    let $button

    const init = function () {
        interfaceOverflow.addDivisor3(21)
        $button = interfaceOverflow.addMenuButton3('Szpieg', 20, $filter('i18n')('description', $rootScope.loc.ale, 'spy_recruiter'))
        $button.addEventListener('click', function () {
            if (spyRecruiter.isRunning()) {
                spyRecruiter.stop()
                utils.notif('success', $filter('i18n')('deactivated', $rootScope.loc.ale, 'spy_recruiter'))
            } else {
                spyRecruiter.start()
                utils.notif('success', $filter('i18n')('activated', $rootScope.loc.ale, 'spy_recruiter'))
            }
        })

        eventQueue.register(eventTypeProvider.SPY_RECRUITER_STARTED, function () {
            $button.classList.remove('btn-orange')
            $button.classList.add('btn-red')
        })

        eventQueue.register(eventTypeProvider.SPY_RECRUITER_STOPPED, function () {
            $button.classList.remove('btn-red')
            $button.classList.add('btn-orange')
        })

        if (spyRecruiter.isRunning()) {
            eventQueue.trigger(eventTypeProvider.SPY_RECRUITER_STARTED)
        }

        return opener
    }

    return init
})

require([
    'two/ready',
    'two/spyRecruiter',
    'two/spyRecruiter/ui',
    'Lockr',
    'queues/EventQueue',
    'two/spyRecruiter/events'
], function(
    ready,
    spyRecruiter,
    spyRecruiterInterface,
    Lockr,
    eventQueue
) {
    const STORAGE_KEYS = {
        ACTIVE: 'spy_recruiter_active'
    }
	
    if (spyRecruiter.isInitialized()) {
        return false
    }
    ready(function() {
        spyRecruiter.init()
        spyRecruiterInterface()

        ready(function() {
            if (Lockr.get(STORAGE_KEYS.ACTIVE, false, true)) {
                spyRecruiter.start()
            }

            eventQueue.register(eventTypeProvider.SPY_RECRUITER_STARTED, function() {
                Lockr.set(STORAGE_KEYS.ACTIVE, true)
            })

            eventQueue.register(eventTypeProvider.SPY_RECRUITER_STOPPED, function() {
                Lockr.set(STORAGE_KEYS.ACTIVE, false)
            })
        }, ['initial_village'])
    })
})
})(this)

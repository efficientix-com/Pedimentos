/**
 * @NApiVersion 2.1
 * @NScriptType ClientScript
 * @NModuleScope SameAccount
 */
define(['N/currentRecord', 'N/log', 'N/record', 'N/search', 'N/ui/message'],
    /**
     * @param{currentRecord} currentRecord
     * @param{log} log
     * @param{record} record
     * @param{search} search
     */
    function (currentRecord, log, record, search, message) {

        /**
         * Function to be executed after page is initialized.
         *
         * @param {Object} scriptContext
         * @param {Record} scriptContext.currentRecord - Current form record
         * @param {string} scriptContext.mode - The mode in which the record is being accessed (create, copy, or edit)
         *
         * @since 2015.2
         */
        function pageInit(scriptContext) {

        }

        /**
         * Function to be executed when field is changed.
         *
         * @param {Object} scriptContext
         * @param {Record} scriptContext.currentRecord - Current form record
         * @param {string} scriptContext.sublistId - Sublist name
         * @param {string} scriptContext.fieldId - Field name
         * @param {number} scriptContext.lineNum - Line number. Will be undefined if not a sublist or matrix field
         * @param {number} scriptContext.columnNum - Line number. Will be undefined if not a matrix field
         *
         * @since 2015.2
         */
        function fieldChanged(scriptContext) {
            try {
                var fieldId = scriptContext.fieldId;
                var sublistId = scriptContext.sublistId;

                console.log({ title: 'fieldId', details: fieldId });
                console.log({ title: 'sublistId', details: sublistId });

            } catch (e) {
                console.error({ title: 'Error fieldChanged', details: e });
            }
        }

        /**
         * Validation function to be executed when sublist line is committed.
         *
         * @param {Object} scriptContext
         * @param {Record} scriptContext.currentRecord - Current form record
         * @param {string} scriptContext.sublistId - Sublist name
         *
         * @returns {boolean} Return true if sublist line is valid
         *
         * @since 2015.2
         */
        function validateLine(scriptContext) {
            try {
                var currentRecordInit = scriptContext.currentRecord
                var sublistId = scriptContext.sublistId;

                console.log({ title: 'sublistId', details: sublistId });
                if (sublistId === 'item') {
                    var contiene_ped = currentRecordInit.getCurrentSublistText({ sublistId: 'item', fieldId: 'custcol_efx_ped_contains' }) || false;
                    console.log({ title: 'contiene_ped', details: contiene_ped });
                    if (contiene_ped === 'T') {
                        console.log({ title: 'currentRecordInit', details: currentRecordInit });
                        var objToSearch = {
                            item: {
                                value: '',
                                text: '',
                                type: ''
                            },
                            location: {
                                value: '',
                                text: '',
                            },
                            serie_lote: [],
                            cantidad: 0,
                            no_pedimento: '',
                            masterPed: []
                        }

                        objToSearch.item.text = currentRecordInit.getCurrentSublistText({ sublistId: 'item', fieldId: 'item' }) || '';
                        objToSearch.item.value = currentRecordInit.getCurrentSublistValue({ sublistId: 'item', fieldId: 'item' }) || '';

                        objToSearch.location.text = currentRecordInit.getCurrentSublistText({ sublistId: 'item', fieldId: 'location' }) || '';
                        objToSearch.location.value = currentRecordInit.getCurrentSublistValue({ sublistId: 'item', fieldId: 'location' }) || '';

                        objToSearch.cantidad = currentRecordInit.getCurrentSublistValue({ sublistId: 'item', fieldId: 'quantity' }) || '';

                        var inventorydetailavail = currentRecordInit.getCurrentSublistValue({ sublistId: 'item', fieldId: 'inventorydetailavail' }) || '';

                        if (inventorydetailavail === 'T') {
                            var inventoryDetail = currentRecordInit.getCurrentSublistSubrecord({ sublistId: 'item', fieldId: 'inventorydetail' });
                            var countInventoryDetail = inventoryDetail.getLineCount({ sublistId: 'inventoryassignment' });
                            console.log({ title: 'countInventoryDetail', details: countInventoryDetail });
                            console.log({ title: 'inventoryDetail', details: inventoryDetail });
                            if (countInventoryDetail > 0) {
                                var arrInvDetail = []
                                for (let indexInvDet = 0; indexInvDet < countInventoryDetail; indexInvDet++) {
                                    var invDetNumId = inventoryDetail.getSublistValue({ sublistId: 'inventoryassignment', fieldId: 'inventorydetail', line: indexInvDet })
                                    var serialLotId = parseInt(inventoryDetail.getSublistValue({ sublistId: 'inventoryassignment', fieldId: 'issueinventorynumber', line: indexInvDet }))
                                    var invDetQty = inventoryDetail.getSublistValue({ sublistId: 'inventoryassignment', fieldId: 'quantity', line: indexInvDet })
                                    var inventorynumber = search.lookupFields({ type: 'inventorynumber', id: serialLotId, columns: 'inventorynumber' }).inventorynumber
                                    arrInvDetail.push({ id: serialLotId, qty: invDetQty, no_serie_lote: inventorynumber });
                                }
                                console.log({ title: 'arrInvDetail', details: arrInvDetail });
                                objToSearch.serie_lote = arrInvDetail;
                            }
                        }
                        console.log({ title: 'Objeto a buscar:', details: objToSearch });

                        let arrMasterPedimentos = getMasterPedimentos(objToSearch);
                        let arrMasterPedimentosToSale = getMasterToSalesOrder(arrMasterPedimentos, objToSearch);
                        let validateLine = validateInformationLine(arrMasterPedimentosToSale, objToSearch);

                        console.log({ title: 'validateLine', details: validateLine });
                        console.log({ title: 'Objeto Mapeado junto con errores:', details: objToSearch });
                        // Mensaje de error
                        if (!validateLine.validation) {
                            createMessage(validateLine)
                            return false
                        } else {
                            currentRecordInit.setCurrentSublistValue({ sublistId: 'item', fieldId: 'custcol_efx_ped_numero_pedimento', value: objToSearch.no_pedimento });
                            return true;
                        }
                    } else {
                        return true;
                    }
                } else {
                    return true;
                }
            } catch (e) {
                console.error({ title: 'Error validateLine:', details: e });
            }
        }
        
        function getMasterToSalesOrder(arrMasterPedimentosAux, objToSearch) {
            try {
                console.log({ title: 'Data to search:', details: { arrMasterPedimentosAux, objToSearch } });
                let filterCustom = [];
                arrMasterPedimentosAux.forEach((masterPibote, index) => {
                    if ((arrMasterPedimentosAux.length - 1) === index) {
                        filterCustom.push(["item", "anyof", masterPibote.item], "AND", ["location", "anyof", objToSearch.location.value], "AND", ["custcol_efx_ped_numero_pedimento", "contains", masterPibote.noPedimento]);
                    } else {
                        filterCustom.push(["item", "anyof", masterPibote.item], "AND", ["location", "anyof", objToSearch.location.value], "AND", ["custcol_efx_ped_numero_pedimento", "contains", masterPibote.noPedimento], 'OR');
                    }
                });

                console.log(arrMasterPedimentosAux);

                var salesorderSearchObj = search.create({
                    type: "salesorder",
                    filters:
                        [
                            ["type", "anyof", "SalesOrd"],
                            "AND",
                            ["mainline", "is", "F"],
                            "AND",
                            filterCustom
                        ],
                    columns:
                        [
                            search.createColumn({ name: "item", label: "Item" }),
                            search.createColumn({ name: "isserialitem", join: "item", label: "Is Serialized Item" }),
                            search.createColumn({ name: "quantity", label: "Quantity" }),
                            search.createColumn({ name: "custcol_efx_ped_numero_pedimento", label: "EFX - Numero de Pedimento" }),
                            search.createColumn({ name: "inventorynumber", join: "inventoryDetail", label: " Number" }),
                            search.createColumn({ name: "quantity", join: "inventoryDetail", label: "Quantity" })
                        ]
                });
                /* console.log(salesorderSearchObj[0].getValue({name:'quantity'})); */
                
                var arrMasterToSale = [];
                const salesOrderSearchPagedData = salesorderSearchObj.runPaged({ pageSize: 1000 });

                for (let i = 0; i < salesOrderSearchPagedData.pageRanges.length; i++) {

                    const salesOrderSearchPage = salesOrderSearchPagedData.fetch({ index: i });
                    salesOrderSearchPage.data.forEach((result) => {
                        const item = result.getValue({ name: "item" });
                        const itemIsSerializedItem = result.getValue({ name: "isserialitem", join: "item" });
                        const quantity = parseFloat(result.getValue({ name: "quantity" }));
                        const efxNumeroDePedimento = result.getValue({ name: "custcol_efx_ped_numero_pedimento" });
                        const inventoryDetailInventoryNumber = result.getText({ name: "inventorynumber", join: "inventoryDetail" });
                        const inventoryDetailQuantity = parseFloat(result.getValue({ name: "quantity", join: "inventoryDetail" }));
                        if (itemIsSerializedItem) {
                            arrMasterToSale.push({ item, quantity: inventoryDetailQuantity, efxNumeroDePedimento, inventoryDetailInventoryNumber })
                        } else {
                            arrMasterToSale.push({ item, quantity, efxNumeroDePedimento })
                        }
                    });
                }
                
                console.log({ title: 'arrMasterToSale', details: arrMasterToSale });

                arrMasterPedimentosAux.map((itemMaster) => {
                    var arrMasterToSaleFilter = arrMasterToSale.filter(masterToSale => masterToSale.item === itemMaster.item && masterToSale.efxNumeroDePedimento.includes(itemMaster.noPedimento)) || [];
                    arrMasterToSaleFilter.forEach((masterToSale) => {
                        itemMaster.qtyAvailable = masterToSale.quantity; // Error: Estaba restando en esta parte
                    });
                })

                console.log({ title: 'Arreglo Acomodado/Filtrado:', details: arrMasterPedimentosAux });
                /*
                salesorderSearchObj.id="customsearch1704398096793";
                salesorderSearchObj.title="TKIO - Busca cantidad comprometida de los maestros de pedimento - SS (copy)";
                var newSearchId = salesorderSearchObj.save();
                */
                return arrMasterPedimentosAux;
            } catch (e) {
                console.error({ title: 'Error getMasterToSalesOrder:', details: e });
                return []
            }
        }

        function getMasterPedimentos(objToSearch) {
            try {
                let filtroBusqueda = [];
                let filtroPib = [];

                filtroBusqueda.push(['custrecord_efx_ped_available', search.Operator.ISNOT, '0.0'], 'AND')
                filtroBusqueda.push(['custrecord_exf_ped_item.internalid', search.Operator.ANYOF, objToSearch.item.value])
                filtroBusqueda.push('AND', ['custrecord_exf_ped_location.internalid', search.Operator.ANYOF, objToSearch.location.value])
                objToSearch.serie_lote.forEach((linePibote, index) => {
                    console.log({ title: 'objToSearch.serie_lote.length', details: objToSearch.serie_lote.length });
                    console.log({ title: 'index', details: index });
                    if ((objToSearch.serie_lote.length - 1) === index) {
                        filtroPib.push(["custrecord_efx_ped_serial_lote", search.Operator.IS, linePibote.no_serie_lote])
                    } else {
                        filtroPib.push(["custrecord_efx_ped_serial_lote", search.Operator.IS, linePibote.no_serie_lote], 'OR')
                    }
                });
                if (filtroPib.length > 0) {
                    filtroBusqueda.push('AND', filtroPib)
                }

                console.log({ title: 'Filtros Busqueda:', details: filtroBusqueda });
                let buscaPed = search.create({
                    type: 'customrecord_efx_ped_master_record',
                    filters: filtroBusqueda,
                    columns: [
                        // search.createColumn({ name: 'internalid' }),
                        search.createColumn({ name: 'custrecord_exf_ped_item' }),
                        search.createColumn({ name: 'custrecord_efx_ped_number' }),
                        search.createColumn({ name: 'custrecord_efx_ped_available' }),
                        search.createColumn({ name: 'custrecord_efx_ped_serial_lote' }),
                    ],
                });

                console.log({ title: 'Filtros', details: buscaPed.filters });
                let ejecutar_pedimento = buscaPed.run();
                let resultado_pedimento = ejecutar_pedimento.getRange(0, 100);
                /* var stok_total = 0; */
                let masterPed = [];
                let masterItems = [];
                for (var x = 0; x < resultado_pedimento.length; x++) {
                    var itemMaster = resultado_pedimento[x].getValue({ name: 'custrecord_exf_ped_item' }) || 'NA';
                    var internalid = resultado_pedimento[x].getValue({ name: 'internalid' }) || 'NA';
                    var noPedMaster = resultado_pedimento[x].getValue({ name: 'custrecord_efx_ped_number' }) || 'NA';
                    var serieLoteMP = resultado_pedimento[x].getValue({ name: 'custrecord_efx_ped_serial_lote' }) || '';
                    let cantidad_av = parseInt(resultado_pedimento[x].getValue({ name: 'custrecord_efx_ped_available' })) || 0;
                    console.log({ title: 'stock', details: cantidad_av});// CON AARON
                    if (itemMaster !== 'NA' && noPedMaster !== 'NA' && cantidad_av > 0) {
                        masterPed.push({
                            // internalid: internalid,
                            item: itemMaster, 
                            qtyAvailable: cantidad_av, 
                            noPedimento: noPedMaster, 
                            serieLoteMP: serieLoteMP
                        })
                        console.log(masterPed);
                        masterItems.push(itemMaster);
                    }
                    /* stok_total += cantidad_av;
                    console.log(stok_total); */
                }
                console.log({ title: 'masterPed', details: masterPed });

                let arrMaster = [];
                //Suma de cantidades disponibles
                let arrMasterNew = masterPed.forEach((masterPib) => {
                    var item = masterPib.item;
                    var noPedimento = masterPib.noPedimento;
                    var serieLoteMP = masterPib.serieLoteMP;
                    var qtyAvailable = masterPib.qtyAvailable;
                    if (arrMaster.some((mp) => mp.item === item && mp.noPedimento === noPedimento && mp.serieLoteMP === serieLoteMP)) {
                        arrMaster.map((mp) => {
                            if (mp.item === item && mp.noPedimento === noPedimento && mp.serieLoteMP === serieLoteMP) {
                                mp.qtyAvailable += qtyAvailable;
                            }
                        })
                    } else {
                        arrMaster.push(masterPib);
                    }
                });

                console.log({ title: 'Array master sumados y agrupados:', details: arrMaster });
                return arrMaster;
            } catch (e) {
                console.error({ title: 'Error getMasterPedimentos:', details: e });
                return [];
            }
        }

        function validateInformationLine(arrMasterPedimentos, objToSearch) {
            try {
                var validation = true;
                var status = '';
                // Mapeo de la informacion para verificar si cumplen con lo necesario para abastecer las lineas
                if (objToSearch.serie_lote.length > 0) {
                    objToSearch.serie_lote.map((lineInvDet, index) => {
                        let objPib = arrMasterPedimentos.find((masterPed) => masterPed.item === objToSearch.item.value && masterPed.serieLoteMP === lineInvDet.no_serie_lote && masterPed.qtyAvailable >= lineInvDet.qty) || null;
                        if (objPib !== null) {
                            objToSearch.masterPed.push({ id: objPib.internalid, noPedimento: objPib.noPedimento });
                            objToSearch.no_pedimento += ((objToSearch.serie_lote.length - 1) === index ? objPib.noPedimento : objPib.noPedimento + ',')
                        } else {
                            lineInvDet.details = '<br/><b>' + objToSearch.item.text + '</b> no se puede abastecer la cantidad de <b>' + lineInvDet.qty + '</b> para el numero de serie <b>' + lineInvDet.no_serie_lote + '</b>'
                            validation = false;
                            status = 'NOT_QTY'
                        }
                    })
                } else {
                    let objPib = arrMasterPedimentos.find((masterPed) => masterPed.item === objToSearch.item.value && masterPed.qtyAvailable >= objToSearch.cantidad) || null;
                    if (objPib !== null) {
                        objToSearch.masterPed.push({ id: objPib.internalid, noPedimento: objPib.noPedimento })
                        objToSearch.no_pedimento += objPib.noPedimento
                    } else {
                        objToSearch.details = '<br/><b>' + objToSearch.item.text + '</b> no se puede abastecer la cantidad de <b>' + objToSearch.cantidad + '</b>'
                        validation = false;
                        status = 'NOT_QTY'
                    }
                }
                return {
                    validation, objToSearch, status
                };
            } catch (e) {
                console.error({ title: 'Error validateInformationLine:', details: e });
                return {
                    validation: false, objToSearch: {}
                };
            }
        }
        function createMessage(objMsg) {
            try {
                var showMsgCust = {
                    title: "",
                    message: '',
                    type: ''
                }
                switch (objMsg.status) {
                    case 'NOT_QTY':
                        showMsgCust.title = "Pedimentos"
                        // showMsgCust.message = 'Por favor asegurese de que tenga stock disponible en sus pedimentos.\nStock Disponible: ' + 'stok_total' + '.' + '\nCantidad solicitada en la transaccion: ' + 'suma_cantidad' + '. Se necesita un stock adicional de ' + 'falta' + ' unidades.'
                        showMsgCust.message = 'Por favor asegurese de que tenga stock disponible en sus pedimentos.'
                        if (objMsg.objToSearch.serie_lote.length > 0) {
                            objMsg.objToSearch.serie_lote.map((lineInvDet, index) => {
                                if (lineInvDet.details) {
                                    showMsgCust.message += lineInvDet.details;
                                }
                            })
                        } else {
                            showMsgCust.message += objMsg.objToSearch.details;
                        }
                        showMsgCust.type = message.Type.WARNING
                        break;
                    case 'ERROR':
                        showMsgCust.title = "ERROR Script"
                        showMsgCust.message = 'Error script: ' + objMsg.e
                        showMsgCust.type = message.Type.ERROR
                        break;
                    default:
                        showMsgCust.title = "Error no identificado."
                        showMsgCust.message = 'Consulte a su administrador'
                        showMsgCust.type = message.Type.ERROR
                        break;
                }
                var myMsg = message.create(showMsgCust);
                myMsg.show();
            } catch (e) {
                console.error({ title: 'Error createMessage:', details: e });
            }
        }
        /**
         * Function to be executed when field is slaved.
         *
         * @param {Object} scriptContext
         * @param {Record} scriptContext.currentRecord - Current form record
         * @param {string} scriptContext.sublistId - Sublist name
         * @param {string} scriptContext.fieldId - Field name
         *
         * @since 2015.2
         */
        function postSourcing(scriptContext) {

        }

        /**
         * Function to be executed after sublist is inserted, removed, or edited.
         *
         * @param {Object} scriptContext
         * @param {Record} scriptContext.currentRecord - Current form record
         * @param {string} scriptContext.sublistId - Sublist name
         *
         * @since 2015.2
         */
        function sublistChanged(scriptContext) {

        }

        /**
         * Function to be executed after line is selected.
         *
         * @param {Object} scriptContext
         * @param {Record} scriptContext.currentRecord - Current form record
         * @param {string} scriptContext.sublistId - Sublist name
         *
         * @since 2015.2
         */
        function lineInit(scriptContext) {

        }

        /**
         * Validation function to be executed when field is changed.
         *
         * @param {Object} scriptContext
         * @param {Record} scriptContext.currentRecord - Current form record
         * @param {string} scriptContext.sublistId - Sublist name
         * @param {string} scriptContext.fieldId - Field name
         * @param {number} scriptContext.lineNum - Line number. Will be undefined if not a sublist or matrix field
         * @param {number} scriptContext.columnNum - Line number. Will be undefined if not a matrix field
         *
         * @returns {boolean} Return true if field is valid
         *
         * @since 2015.2
         */
        function validateField(scriptContext) {

        }

        /**
         * Validation function to be executed when sublist line is inserted.
         *
         * @param {Object} scriptContext
         * @param {Record} scriptContext.currentRecord - Current form record
         * @param {string} scriptContext.sublistId - Sublist name
         *
         * @returns {boolean} Return true if sublist line is valid
         *
         * @since 2015.2
         */
        function validateInsert(scriptContext) {

        }

        /**
         * Validation function to be executed when record is deleted.
         *
         * @param {Object} scriptContext
         * @param {Record} scriptContext.currentRecord - Current form record
         * @param {string} scriptContext.sublistId - Sublist name
         *
         * @returns {boolean} Return true if sublist line is valid
         *
         * @since 2015.2
         */
        function validateDelete(scriptContext) {

        }

        /**
         * Validation function to be executed when record is saved.
         *
         * @param {Object} scriptContext
         * @param {Record} scriptContext.currentRecord - Current form record
         * @returns {boolean} Return true if record is valid
         *
         * @since 2015.2
         */
        function saveRecord(scriptContext) {

        }

        return {
            pageInit: pageInit,
            fieldChanged: fieldChanged,
            validateLine: validateLine,
            // postSourcing: postSourcing,
            // sublistChanged: sublistChanged,
            // lineInit: lineInit,
            // validateField: validateField,
            // validateInsert: validateInsert,
            // validateDelete: validateDelete,
            // saveRecord: saveRecord
        };

    });

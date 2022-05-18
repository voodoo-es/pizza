odoo.define('pizza_modifiers.Orderline', function(require) {
    'use strict';

    const Orderline = require('point_of_sale.Orderline');
    const Registries = require('point_of_sale.Registries');
    var core = require('web.core');
    var QWeb = core.qweb;

    const PizzaModifiersOrderline = Orderline =>
        class extends Orderline {
            /**
             * @override
             */
            get addedClasses() {
                const res = super.addedClasses;
                Object.assign(res, {
                    modifier: this.props.line.parent_line_id,
                });
                return res;
            }
            ediModifiers() {
                var self = this;
                var variant = self.props.line.product;
                var tmpl = self.env.pos.db.template_by_id[variant.product_tmpl_id];
                if (tmpl.is_modifier && tmpl.modifier_ids.length > 0) {
                    var pdct_tmpl = self.env.pos.db.template_by_id[variant.product_tmpl_id];
                    if (!pdct_tmpl.allow_portion) {
                        // Non Portion Flow
                        var $el = $('.modifiers-screen');
                        $('div.products-widget').addClass('oe_hidden');
                        $el.removeClass('oe_hidden');
                        $('.modifiers-screen').find('.product-name').text(variant.display_name);

                        var modifier_lists = [];
                        $.each(tmpl.modifier_ids, function(idx, modifier_id) {
                            var modifier = self.env.pos.db.modifiers_by_id[modifier_id];
                            var modifier_product = self.env.pos.db.get_product_by_id(modifier.name[0]);
                            modifier_product.lst_price = modifier.price;
                            modifier_product.image_url = window.location.origin + '/web/image?model=product.product&field=image_1920&id=' + modifier_product.id;
                            modifier_lists.push(modifier_product);
                        });

                        var productsgroupby = [];
                        $.each(modifier_lists, function(idx, modifier_list) {
                            // var att_value = modifier_list.attribute_value_ids[0];
                            // var att = self.env.pos.db.product_attribute_value_by_id[att_value];
                            var newobj = { 'name': modifier_list.name, 'id': modifier_list.id, 'products': [] };

                            var res = _.find(productsgroupby, function(val) {
                                return _.isEqual(newobj['name'], val['name'])
                            });
                            if (!_.isObject(res)) {
                                newobj['products'].push(modifier_list);
                                productsgroupby.push(newobj);
                            } else {
                                res['products'].push(modifier_list);
                            }
                        });
                        var modifier_products_html = QWeb.render('ModifierProduct', {
                            widget: self,
                            products: modifier_lists,
                            portions: false,
                            productsgroupby: productsgroupby
                        });

                        $el.find('.modifier_views').html(modifier_products_html);
                        // self.env.pos.get('selectedOrder').add_product(variant, { 'merge': false });
                        var parent_line = self.props.line;
                        var currentOrderline = self.props.line;
                        $el.find('.button.back').attr('data-parent_line', parent_line.id);
                        $el.find('.modifier-done').attr('data-parent_line', parent_line.id);

                        $el.find('.modifiers-list .productgroup').click(function() {
                            var groupid = $(this).attr('data-productgroup-id');
                            $(this).parent().find('.productgroup').removeClass('selected');
                            $(this).addClass('selected');

                            $(this).parent().find('.productlist').removeClass('selected');
                            $(this).parent().find('.productlist[data-productgroup-id=' + groupid + ']').addClass('selected');
                        });

                        $el.find('.modifiers-list .modifier .button').click(function() {
                            var modifier_id = $(this).attr('data-product-id');
                            $(this).attr('data-order_line_id', self.env.pos.get_order().selected_orderline.id);
                            var attrLineId = parseInt($(this).attr('data-order_line_id'))
                            var modifier = self.env.pos.db.get_product_by_id(modifier_id);
                            var options = { 'merge': false, 'extras': { 'parent_line_id': attrLineId } };
                            var lines = self.env.pos.get_order().orderlines.models.filter(item => item.parent_line_id === attrLineId);
                            if (lines.length > 0) {
                                var m_line_id = lines.filter(item => item.product.id === parseInt(modifier_id));
                                if (m_line_id.length > 0) {
                                    m_line_id[0].order.m_remove_orderline(m_line_id[0]);
                                } else {
                                    self.env.pos.get('selectedOrder').m_add_product(modifier, options);
                                }
                            } else {
                                self.env.pos.get('selectedOrder').m_add_product(modifier, options);
                            }
                        });

                        $el.find('.button.back').click(function() {
                            self.gui.current_screen.$el.find('.modifiers-screen').addClass('oe_hidden');
                            self.gui.current_screen.$el.find('table.layout-table').removeClass('oe_hidden');

                            // Remove line along with modifiers line
                            var parent_line_id = $(this).attr('data-parent_line');
                            var lines = self.env.pos.get('selectedOrder').get_orderlines();
                            if (parent_line_id) {
                                var remove_orderline = [];
                                for (var i = 0; i < lines.length; i++) {
                                    if (lines[i].id === parseInt(parent_line_id)) {
                                        remove_orderline.push(lines[i]);
                                    } else if (lines[i].parent_line_id === parseInt(parent_line_id)) {
                                        remove_orderline.push(lines[i]);
                                    }
                                }
                                for (var i = 0; i < remove_orderline.length; i++) {
                                    self.env.pos.get('selectedOrder').remove_orderline(remove_orderline[i]);
                                }
                            }
                        });
                        $el.find('.modifier-done').click(function() {
                            var main_line_id = $(this).attr('data-parent_line');
                            var line = self.env.pos.get('selectedOrder').get_orderline(parseInt(main_line_id));
                            var tmpl_id = line.product.product_tmpl_id;
                            var tmpl = self.env.pos.db.template_by_id[tmpl_id];
                            if (tmpl.apply_selector) {
                                var min = tmpl.min_selector;
                                var max = tmpl.max_selector;
                                var lines = self.env.pos.get('selectedOrder').get_orderlines();
                                var total_selector = 0;

                                for (var i = 0; i < lines.length; i++) {
                                    if (lines[i].parent_line_id === parseInt(main_line_id)) {
                                        total_selector += 1;
                                    }
                                }
                                if (total_selector < min) {
                                    self.pos.gui.show_popup('error-traceback', {
                                        'title': _t('Minimum Selector'),
                                        'body': 'Select at-least ' + min + ' add-ons for this item.',
                                    });
                                    return;
                                }
                                if (total_selector > max) {
                                    self.pos.gui.show_popup('error-traceback', {
                                        'title': _t('Maximum Selector'),
                                        'body': 'Maximum select up to ' + max + ' add-ons for this item.',
                                    });
                                    return;
                                }
                            }

                            $('.modifiers-screen').addClass('oe_hidden');
                            $('div.products-widget').removeClass('oe_hidden');
                        });
                    }
                } else {
                    if (self.env.pos.get_order().selected_orderline) {
                        var parent_line = self.env.pos.get_order().selected_orderline.get_parent_line_id();
                        var options_dict = {};
                        if (parent_line)
                            options_dict = { 'merge': false, 'extras': { 'parent_line_id': parent_line } };
                        self.env.pos.get('selectedOrder').add_product(variant, options_dict);
                    } else {
                        var options_dict = { 'merge': false };
                        self.env.pos.get('selectedOrder').add_product(variant, options_dict);
                    }

                }
            }
        };

    Registries.Component.extend(Orderline, PizzaModifiersOrderline);

    return Orderline;
});